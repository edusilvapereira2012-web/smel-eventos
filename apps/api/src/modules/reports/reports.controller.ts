import { Controller, Get, Param, Query, Res, Req, Headers, Ip, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { RequirePermission } from '../../common/rbac/require-permission.decorator';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('events/:eventId/export')
  @RequirePermission('events.view')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiQuery({ name: 'format', enum: ['csv', 'xlsx'], required: true })
  @ApiQuery({ name: 'sensitive', type: Boolean, required: false })
  @ApiOperation({ summary: 'Exporta as inscrições do evento em CSV ou Excel (xlsx)' })
  @ApiResponse({ status: 200, description: 'Exportação gerada com sucesso' })
  async export(
    @Param('eventId') eventId: string,
    @Query('format') format: 'csv' | 'xlsx',
    @Query('sensitive') sensitive: string,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any,
    @Ip() ip: string,
    @Res() res: any,
  ) {
    const isSensitive = sensitive === 'true';
    const userId = req.user?.id;
    const userAgent = req.headers['user-agent'] as string;

    if (format === 'csv') {
      const { csvContent, eventSlug } = await this.reportsService.exportCsv(
        eventId,
        isSensitive,
        tenantId,
        userId,
        ip,
        userAgent,
      );

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="registrants-${eventSlug}.csv"`);
      return res.status(200).send(csvContent);
    } else if (format === 'xlsx') {
      const { buffer, eventSlug } = await this.reportsService.exportExcel(
        eventId,
        isSensitive,
        tenantId,
        userId,
        ip,
        userAgent,
      );

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="registrants-${eventSlug}.xlsx"`);
      return res.status(200).send(buffer);
    } else {
      throw new BadRequestException('Formato de exportação inválido. Use "csv" ou "xlsx".');
    }
  }

  @Get('events/:eventId/presence-list')
  @RequirePermission('events.view')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Gera a lista de presença em PDF com linhas para assinatura' })
  @ApiResponse({ status: 200, description: 'PDF de presença gerado com sucesso' })
  async presenceList(
    @Param('eventId') eventId: string,
    @Headers('x-tenant-id') tenantId: string,
    @Query('workshopId') workshopId: string,
    @Res() res: any,
  ) {
    const { buffer, eventSlug } = await this.reportsService.generatePresenceListPdf(eventId, tenantId, workshopId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="presence-list-${eventSlug}.pdf"`);
    return res.status(200).send(buffer);
  }
}
