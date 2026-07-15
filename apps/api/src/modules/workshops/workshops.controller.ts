import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Headers,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { WorkshopsService } from './workshops.service';
import { CreateWorkshopDto, UpdateWorkshopDto } from './dto/workshop.dto';
import { RequirePermission } from '../../common/rbac/require-permission.decorator';
import { Public } from '../auth/guards/public.decorator';
import { SkipTenant } from '../../common/tenant/skip-tenant.decorator';

@ApiTags('Workshops')
@ApiBearerAuth()
@ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
@Controller('events/:eventId/workshops')
export class WorkshopsController {
  constructor(private readonly workshopsService: WorkshopsService) {}

  @Post()
  @RequirePermission('events.update')
  create(
    @Param('eventId') eventId: string,
    @Body() dto: CreateWorkshopDto,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any,
  ) {
    return this.workshopsService.create(eventId, dto, tenantId, req.user.id, req.ip, req.headers['user-agent']);
  }

  @Get()
  @RequirePermission('events.view')
  findAll(
    @Param('eventId') eventId: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.workshopsService.findAll(eventId, tenantId);
  }

  @Get(':id')
  @RequirePermission('events.view')
  findOne(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.workshopsService.findOne(eventId, id, tenantId);
  }

  @Patch(':id')
  @RequirePermission('events.update')
  update(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWorkshopDto,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any,
  ) {
    return this.workshopsService.update(eventId, id, dto, tenantId, req.user.id, req.ip, req.headers['user-agent']);
  }

  @Delete(':id')
  @RequirePermission('events.update')
  remove(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any,
  ) {
    return this.workshopsService.remove(eventId, id, tenantId, req.user.id, req.ip, req.headers['user-agent']);
  }

  @Get(':id/enrollments')
  @RequirePermission('events.view')
  getEnrollments(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.workshopsService.getEnrollments(eventId, id, tenantId);
  }

  @Post(':id/enrollments/:registrationId')
  @RequirePermission('events.update')
  enrollParticipant(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Param('registrationId') registrationId: string,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any,
  ) {
    return this.workshopsService.enrollParticipant(
      eventId,
      registrationId,
      id,
      tenantId,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Delete(':id/enrollments/:registrationId')
  @RequirePermission('events.update')
  cancelParticipantEnrollment(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Param('registrationId') registrationId: string,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any,
  ) {
    return this.workshopsService.cancelParticipantEnrollment(
      eventId,
      registrationId,
      id,
      tenantId,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }
}

@ApiTags('Public Workshops')
@Controller('public')
export class PublicWorkshopsController {
  constructor(private readonly workshopsService: WorkshopsService) {}

  @Get('events/slug/:slug/workshops')
  @Public()
  @SkipTenant()
  @ApiOperation({ summary: 'Obtém lista pública de oficinas do evento pelo slug' })
  listWorkshopsPublic(@Param('slug') slug: string) {
    return this.workshopsService.listWorkshopsPublic(slug);
  }
}
