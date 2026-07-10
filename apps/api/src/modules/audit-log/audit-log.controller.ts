import { Controller, Get, Query, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { RequirePermission } from '../../common/rbac/require-permission.decorator';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@Controller('admin/audit-logs')
export class AuditLogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('audit-logs.view')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Obtém os logs de auditoria do tenant' })
  @ApiResponse({ status: 200, description: 'Lista de logs obtida com sucesso' })
  async getAuditLogs(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Req() req?: any,
  ) {
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.max(1, Math.min(100, parseInt(limit, 10)));
    const skip = (p - 1) * l;

    // Obter o tenantId ativo
    const tenantId = req.headers['x-tenant-id'] || req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant context missing. X-Tenant-ID header required.');
    }

    // Obter todos os IDs de usuários membros deste tenant para isolamento multi-tenant
    const memberships = await this.prisma.tenantMembership.findMany({
      where: { tenantId },
      select: { userId: true },
    });
    const memberUserIds = memberships.map((m) => m.userId);

    const where: any = {};

    if (userId) {
      if (memberUserIds.includes(userId)) {
        where.userId = userId;
      } else {
        // Se o usuário solicitado não faz parte do tenant, retorna vazio
        return {
          data: [],
          meta: {
            total: 0,
            page: p,
            limit: l,
            totalPages: 0,
          },
        };
      }
    } else {
      where.userId = { in: memberUserIds };
    }

    if (action) {
      where.action = { contains: action, mode: 'insensitive' };
    }
    if (resource) {
      where.resource = { contains: resource, mode: 'insensitive' };
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
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: l,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page: p,
        limit: l,
        totalPages: Math.ceil(total / l),
      },
    };
  }
}
