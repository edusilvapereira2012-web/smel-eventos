import { Controller, Get, Param, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader, ApiResponse } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { RequirePermission } from '../../common/rbac/require-permission.decorator';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @RequirePermission('dashboard.view')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Obtém indicadores gerais do tenant (com cache)' })
  @ApiResponse({ status: 200, description: 'Indicadores do dashboard carregados com sucesso' })
  getOverview(@Headers('x-tenant-id') tenantId: string) {
    return this.dashboardService.getOverview(tenantId);
  }

  @Get('events/:eventId')
  @RequirePermission('dashboard.view')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Obtém indicadores detalhados de um evento específico' })
  @ApiResponse({ status: 200, description: 'Métricas do evento carregadas com sucesso' })
  getEventStats(
    @Param('eventId') eventId: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.dashboardService.getEventStats(eventId, tenantId);
  }
}
