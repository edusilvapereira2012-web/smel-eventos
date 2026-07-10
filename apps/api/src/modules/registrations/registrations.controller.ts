import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader, ApiResponse } from '@nestjs/swagger';
import { RegistrationsService } from './registrations.service';
import { TransferRegistrationDto, ListRegistrationsQueryDto } from './dto/registration.dto';
import { RequirePermission } from '../../common/rbac/require-permission.decorator';

@ApiTags('Registrations')
@ApiBearerAuth()
@Controller('events/:eventId/registrations')
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Get()
  @RequirePermission('events.view')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Lista todas as inscrições do evento (retorna CPF mascarado)' })
  findAll(
    @Param('eventId') eventId: string,
    @Query() query: ListRegistrationsQueryDto,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.registrationsService.findAll(eventId, query, tenantId);
  }

  @Get('export/cpf')
  @RequirePermission('registrations.view-cpf')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Exporta todas as inscrições do evento com CPF descriptografado' })
  exportCpf(
    @Param('eventId') eventId: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.registrationsService.exportCpf(eventId, tenantId);
  }

  @Get(':id')
  @RequirePermission('events.view')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Busca detalhes de uma inscrição' })
  findOne(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.registrationsService.findOne(eventId, id, tenantId);
  }

  @Get('code/:code')
  @RequirePermission('events.view')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Busca uma inscrição pelo código sequencial' })
  findByCode(
    @Param('eventId') eventId: string,
    @Param('code') code: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.registrationsService.findByCode(eventId, code, tenantId);
  }

  @Delete(':id')
  @RequirePermission('events.update')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Cancela uma inscrição (organizador)' })
  cancel(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body('cancelReason') cancelReason: string | undefined,
    @Req() req: any,
  ) {
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.registrationsService.cancel(eventId, id, cancelReason, req.user.id, ip, userAgent);
  }

  @Post(':id/transfer')
  @RequirePermission('events.update')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Transfere uma inscrição para outro participante' })
  transfer(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: TransferRegistrationDto,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any,
  ) {
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.registrationsService.transfer(eventId, id, dto, tenantId, req.user.id, ip, userAgent);
  }
}
