import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  Headers,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader, ApiResponse } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CreateEventDto, UpdateEventDto, ListEventsQueryDto } from './dto/event.dto';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateSpeakerDto,
  UpdateSpeakerDto,
  CreateSponsorDto,
  UpdateSponsorDto,
  CreateScheduleItemDto,
  UpdateScheduleItemDto,
  ReorderScheduleDto,
} from './dto/subresources.dto';
import { Public } from '../auth/guards/public.decorator';
import { SkipTenant } from '../../common/tenant/skip-tenant.decorator';
import { RequirePermission } from '../../common/rbac/require-permission.decorator';

@ApiTags('Events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // --- EVENTS ---

  @Post()
  @RequirePermission('events.create')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Cria um novo evento no tenant' })
  @ApiResponse({ status: 201, description: 'Evento criado com sucesso' })
  create(
    @Body() createEventDto: CreateEventDto,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any,
  ) {
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.eventsService.create(createEventDto, tenantId, req.user.id, ip, userAgent);
  }

  @Get()
  @RequirePermission('events.view')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Lista eventos do tenant com filtros e paginação cursor-based' })
  @ApiResponse({ status: 200, description: 'Lista de eventos retornada com sucesso' })
  findAll(
    @Query() query: ListEventsQueryDto,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.eventsService.findAll(query, tenantId);
  }

  // --- SUB-RESOURCES: CATEGORIES ---

  @Get('categories')
  @RequirePermission('events.view')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Lista todas as categorias do tenant' })
  getCategories(@Headers('x-tenant-id') tenantId: string) {
    return this.eventsService.getCategories(tenantId);
  }

  @Post('categories')
  @RequirePermission('events.create')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Cria uma nova categoria' })
  createCategory(
    @Body() dto: CreateCategoryDto,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.eventsService.createCategory(dto, tenantId);
  }

  @Patch('categories/:id')
  @RequirePermission('events.create')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Atualiza uma categoria' })
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.eventsService.updateCategory(id, dto, tenantId);
  }

  @Delete('categories/:id')
  @RequirePermission('events.delete')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Exclui uma categoria' })
  deleteCategory(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.eventsService.deleteCategory(id, tenantId);
  }

  @Get('slug/:slug')
  @Public()
  @SkipTenant()
  @ApiOperation({ summary: 'Busca um evento público pelo slug' })
  @ApiResponse({ status: 200, description: 'Detalhes do evento público retornados com sucesso' })
  findBySlug(@Param('slug') slug: string) {
    return this.eventsService.findBySlug(slug);
  }

  @Get(':id')
  @RequirePermission('events.view')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Busca um evento por ID' })
  @ApiResponse({ status: 200, description: 'Detalhes do evento retornados com sucesso' })
  findOne(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.eventsService.findOne(id, tenantId);
  }

  @Patch(':id')
  @RequirePermission('events.update')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Atualiza um evento' })
  @ApiResponse({ status: 200, description: 'Evento atualizado com sucesso' })
  update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any,
  ) {
    if (req.user.email !== 'valterpcjr@gmail.com') {
      if (!updateEventDto.justification || updateEventDto.justification.trim() === '') {
        throw new BadRequestException('A justificativa da edição é obrigatória para organizadores/admins.');
      }
    }
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.eventsService.update(id, updateEventDto, tenantId, req.user.id, ip, userAgent);
  }

  @Delete(':id')
  @RequirePermission('events.delete')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Exclui um evento (apenas se DRAFT e sem inscrições)' })
  @ApiResponse({ status: 200, description: 'Evento excluído com sucesso' })
  remove(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any,
  ) {
    if (req.user.email !== 'valterpcjr@gmail.com') {
      throw new ForbiddenException('Apenas o Superadmin pode excluir eventos.');
    }
    return this.eventsService.remove(id, tenantId);
  }

  // --- ACTIONS ---

  @Patch(':id/publish')
  @RequirePermission('events.update')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Publica um evento (DRAFT -> PUBLISHED)' })
  publish(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any,
  ) {
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.eventsService.publish(id, tenantId, req.user.id, ip, userAgent);
  }

  @Patch(':id/cancel')
  @RequirePermission('events.update')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Cancela um evento' })
  cancel(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any,
  ) {
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.eventsService.cancel(id, tenantId, req.user.id, ip, userAgent);
  }

  @Patch(':id/finish')
  @RequirePermission('events.update')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Finaliza um evento' })
  finish(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any,
  ) {
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.eventsService.finish(id, tenantId, req.user.id, ip, userAgent);
  }

  // --- SUB-RESOURCES: SPEAKERS ---

  @Get(':eventId/speakers')
  @RequirePermission('events.view')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Lista os palestrantes do evento' })
  getSpeakers(
    @Param('eventId') eventId: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.eventsService.getSpeakers(eventId, tenantId);
  }

  @Post(':eventId/speakers')
  @RequirePermission('events.update')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Adiciona um palestrante ao evento' })
  createSpeaker(
    @Param('eventId') eventId: string,
    @Body() dto: CreateSpeakerDto,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.eventsService.createSpeaker(eventId, dto, tenantId);
  }

  @Patch(':eventId/speakers/:id')
  @RequirePermission('events.update')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Atualiza dados do palestrante' })
  updateSpeaker(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSpeakerDto,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.eventsService.updateSpeaker(eventId, id, dto, tenantId);
  }

  @Delete(':eventId/speakers/:id')
  @RequirePermission('events.update')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Exclui um palestrante do evento' })
  deleteSpeaker(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.eventsService.deleteSpeaker(eventId, id, tenantId);
  }

  // --- SUB-RESOURCES: SPONSORS ---

  @Get(':eventId/sponsors')
  @RequirePermission('events.view')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Lista patrocinadores do evento' })
  getSponsors(
    @Param('eventId') eventId: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.eventsService.getSponsors(eventId, tenantId);
  }

  @Post(':eventId/sponsors')
  @RequirePermission('events.update')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Adiciona patrocinador ao evento' })
  createSponsor(
    @Param('eventId') eventId: string,
    @Body() dto: CreateSponsorDto,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.eventsService.createSponsor(eventId, dto, tenantId);
  }

  @Patch(':eventId/sponsors/:id')
  @RequirePermission('events.update')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Atualiza patrocinador do evento' })
  updateSponsor(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSponsorDto,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.eventsService.updateSponsor(eventId, id, dto, tenantId);
  }

  @Delete(':eventId/sponsors/:id')
  @RequirePermission('events.update')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Remove patrocinador do evento' })
  deleteSponsor(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.eventsService.deleteSponsor(eventId, id, tenantId);
  }

  // --- SUB-RESOURCES: SCHEDULE ---

  @Get(':eventId/schedule')
  @RequirePermission('events.view')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Lista itens de programação do evento' })
  getSchedule(
    @Param('eventId') eventId: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.eventsService.getSchedule(eventId, tenantId);
  }

  @Post(':eventId/schedule')
  @RequirePermission('events.update')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Adiciona item de programação ao evento' })
  createScheduleItem(
    @Param('eventId') eventId: string,
    @Body() dto: CreateScheduleItemDto,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.eventsService.createScheduleItem(eventId, dto, tenantId);
  }

  @Patch(':eventId/schedule/reorder')
  @RequirePermission('events.update')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Reordena a programação' })
  reorderSchedule(
    @Param('eventId') eventId: string,
    @Body() dto: ReorderScheduleDto,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.eventsService.reorderSchedule(eventId, dto.ids, tenantId);
  }

  @Patch(':eventId/schedule/:id')
  @RequirePermission('events.update')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Atualiza item de programação' })
  updateScheduleItem(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: UpdateScheduleItemDto,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.eventsService.updateScheduleItem(eventId, id, dto, tenantId);
  }

  @Delete(':eventId/schedule/:id')
  @RequirePermission('events.update')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Remove item de programação' })
  deleteScheduleItem(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.eventsService.deleteScheduleItem(eventId, id, tenantId);
  }
}
