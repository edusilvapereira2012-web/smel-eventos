import { Controller, Post, Body, Req, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader, ApiResponse } from '@nestjs/swagger';
import { CheckInService } from './checkin.service';
import { ValidateQRCodeDto, SyncOfflineCheckInsDto } from './dto/checkin.dto';
import { RequirePermission } from '../../common/rbac/require-permission.decorator';

@ApiTags('Check-In')
@ApiBearerAuth()
@Controller('checkin')
export class CheckInController {
  constructor(private readonly checkInService: CheckInService) {}

  @Post('validate')
  @RequirePermission('checkin.perform')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Valida o JWT do QR Code e realiza o check-in do participante' })
  @ApiResponse({ status: 201, description: 'Check-in realizado com sucesso' })
  async validate(
    @Body() dto: ValidateQRCodeDto,
    @Req() req: any,
  ) {
    const operatorId = req.user?.id;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.checkInService.validateAndCheckIn(dto.token, operatorId, dto.deviceId, ip, userAgent);
  }

  @Post('sync')
  @RequirePermission('checkin.perform')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Sincroniza um lote de check-ins coletados offline pelo PWA' })
  @ApiResponse({ status: 201, description: 'Processamento do lote concluído' })
  async sync(
    @Body() dto: SyncOfflineCheckInsDto,
    @Req() req: any,
  ) {
    const operatorId = req.user?.id;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.checkInService.syncOffline(dto.checkins, operatorId, ip, userAgent);
  }

  @Get('stats/:eventId')
  @RequirePermission('events.view')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Obtém estatísticas em tempo real do check-in de um evento' })
  @ApiResponse({ status: 200, description: 'Estatísticas obtidas com sucesso' })
  async getStats(
    @Param('eventId') eventId: string,
  ) {
    return this.checkInService.getStats(eventId);
  }
}
