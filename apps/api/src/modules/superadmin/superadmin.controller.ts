import { Controller, Get, Post, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SuperadminService } from './superadmin.service';
import { SuperadminGuard } from '../../common/guards/superadmin.guard';
import { SkipTenant } from '../../common/tenant/skip-tenant.decorator';
import { EmailStatus } from '@prisma/client';

@ApiTags('Superadmin')
@ApiBearerAuth()
@UseGuards(SuperadminGuard)
@SkipTenant()
@Controller('superadmin')
export class SuperadminController {
  constructor(private readonly superadminService: SuperadminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Obtém estatísticas gerais do sistema' })
  getStats() {
    return this.superadminService.getStats();
  }

  @Get('tenants')
  @ApiOperation({ summary: 'Lista todas as organizações registradas no sistema' })
  getTenants() {
    return this.superadminService.getTenants();
  }

  @Post('tenants/:id/toggle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ativa ou desativa uma organização específica' })
  toggleTenant(@Param('id') id: string) {
    return this.superadminService.toggleTenantStatus(id);
  }

  @Get('users')
  @ApiOperation({ summary: 'Lista todos os usuários registrados no sistema' })
  getUsers() {
    return this.superadminService.getUsers();
  }

  @Post('users/:id/toggle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ativa ou desativa uma conta de usuário' })
  toggleUser(@Param('id') id: string) {
    return this.superadminService.toggleUserStatus(id);
  }

  @Get('email/logs')
  @ApiOperation({ summary: 'Lista logs de e-mail do sistema global' })
  getEmailLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: EmailStatus,
    @Query('search') search?: string,
  ) {
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;
    return this.superadminService.getEmailLogs(pageNum, limitNum, status, search);
  }

  @Get('email/stats')
  @ApiOperation({ summary: 'Obtém estatísticas globais de envio de e-mails' })
  getEmailStats() {
    return this.superadminService.getEmailStats();
  }

  @Post('email/retry/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Re-enfileira um e-mail específico globalmente' })
  retryEmail(@Param('id') id: string) {
    return this.superadminService.retryEmail(id);
  }
}

