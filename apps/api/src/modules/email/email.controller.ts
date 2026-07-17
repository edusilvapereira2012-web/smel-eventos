import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
  ForbiddenException,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader, ApiResponse } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { RequirePermission } from '../../common/rbac/require-permission.decorator';
import { EmailStatus } from '@prisma/client';

@ApiTags('Admin Email')
@ApiBearerAuth()
@ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
@Controller('admin/email')
export class EmailController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('email') private readonly emailQueue: Queue,
    @InjectQueue('email-dead') private readonly emailDeadQueue: Queue,
  ) {}

  @Get('logs')
  @RequirePermission('tenants.update')
  @ApiOperation({ summary: 'Lista os logs de e-mail da organização ativa' })
  async getLogs(
    @Req() req: any,
    @Query('status') status?: EmailStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const tenantId = req.headers['x-tenant-id'] as string;
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const where: any = { tenantId };

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.emailLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      this.prisma.emailLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  @Get('stats')
  @RequirePermission('tenants.update')
  @ApiOperation({ summary: 'Retorna estatísticas de envios de e-mail da organização' })
  async getStats(@Req() req: any) {
    const tenantId = req.headers['x-tenant-id'] as string;

    const counts = await this.prisma.emailLog.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: true,
    });

    const stats = {
      sent: 0,
      failed: 0,
      dead: 0,
      pendingInQueue: 0,
    };

    for (const group of counts) {
      if (group.status === EmailStatus.SENT) stats.sent = group._count;
      if (group.status === EmailStatus.FAILED) stats.failed = group._count;
      if (group.status === EmailStatus.DEAD) stats.dead = group._count;
      if (group.status === EmailStatus.PENDING) stats.pendingInQueue = group._count;
    }

    return stats;
  }

  @Post('retry/:id')
  @RequirePermission('tenants.update')
  @ApiOperation({ summary: 'Re-enfileira um e-mail específico' })
  @HttpCode(HttpStatus.OK)
  async retryEmail(@Param('id') id: string, @Req() req: any) {
    const tenantId = req.headers['x-tenant-id'] as string;

    const emailLog = await this.prisma.emailLog.findUnique({
      where: { id },
    });

    if (!emailLog || emailLog.tenantId !== tenantId) {
      throw new NotFoundException('Log de e-mail não encontrado para a organização ativa.');
    }

    // Atualiza status para PENDING e reseta tentativas
    const updatedLog = await this.prisma.emailLog.update({
      where: { id },
      data: {
        status: EmailStatus.PENDING,
        attempts: 0,
        lastError: null,
      },
    });

    // Re-enfileira o job na fila principal
    await this.emailQueue.add(
      updatedLog.template,
      { emailLogId: updatedLog.id },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: false,
      },
    );

    return {
      message: 'E-mail reenviado com sucesso para a fila.',
      log: updatedLog,
    };
  }

  @Post('retry-dead')
  @ApiOperation({ summary: 'Re-enfileira todos os e-mails DEAD da organização ativa (Apenas OWNER)' })
  @HttpCode(HttpStatus.OK)
  async retryDeadEmails(@Req() req: any) {
    const tenantId = req.headers['x-tenant-id'] as string;
    const userId = req.user?.id;

    const isSuperAdmin = req.user?.email === 'valterpcjr@gmail.com';

    if (!isSuperAdmin) {
      // Valida se o usuário é OWNER da organização
      const membership = await this.prisma.tenantMembership.findUnique({
        where: {
          tenantId_userId: {
            tenantId,
            userId,
          },
        },
      });

      if (!membership || membership.role !== 'OWNER') {
        throw new ForbiddenException('Apenas o proprietário (OWNER) da organização pode realizar esta ação.');
      }
    }

    // Busca todos os logs DEAD
    const deadLogs = await this.prisma.emailLog.findMany({
      where: {
        tenantId,
        status: EmailStatus.DEAD,
      },
    });

    if (deadLogs.length === 0) {
      return {
        message: 'Nenhum e-mail com status DEAD encontrado.',
        count: 0,
      };
    }

    // Atualiza todos para PENDING
    await this.prisma.emailLog.updateMany({
      where: {
        tenantId,
        status: EmailStatus.DEAD,
      },
      data: {
        status: EmailStatus.PENDING,
        attempts: 0,
        lastError: null,
      },
    });

    // Adiciona todos de volta na fila principal
    for (const log of deadLogs) {
      await this.emailQueue.add(
        log.template,
        { emailLogId: log.id },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 100 },
          removeOnFail: false,
        },
      );
    }

    // Limpa a fila dead do BullMQ para este tenant (opcional, como o log já foi atualizado, a fila dead no redis é esvaziada)
    await this.emailDeadQueue.drain();

    return {
      message: `${deadLogs.length} e-mails re-enfileirados com sucesso.`,
      count: deadLogs.length,
    };
  }
}
