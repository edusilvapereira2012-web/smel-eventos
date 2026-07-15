import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  Delete,
  Req,
  UseGuards,
  Headers,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader, ApiResponse } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { SkipTenant } from '../../common/tenant/skip-tenant.decorator';
import { RequirePermission } from '../../common/rbac/require-permission.decorator';

@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @SkipTenant()
  @ApiOperation({ summary: 'Cria um novo tenant' })
  @ApiResponse({ status: 201, description: 'Tenant criado com sucesso.' })
  create(
    @Body() createTenantDto: CreateTenantDto,
    @Req() req: any,
  ) {
    if (req.user.email !== 'valterpcjr@gmail.com') {
      throw new ForbiddenException('Apenas o Superadmin pode criar novas organizações.');
    }
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.tenantsService.create(createTenantDto, req.user.id, ip, userAgent);
  }

  @Get()
  @SkipTenant()
  @ApiOperation({ summary: 'Lista os tenants do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Lista de tenants retornada com sucesso.' })
  findAll(@Req() req: any) {
    return this.tenantsService.getMyTenants(req.user.id);
  }

  @Get(':id')
  @RequirePermission('events.view')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Retorna detalhes de um tenant' })
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('tenants.update')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Atualiza informações do tenant' })
  update(
    @Param('id') id: string,
    @Body() updateTenantDto: UpdateTenantDto,
    @Req() req: any,
  ) {
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.tenantsService.update(id, updateTenantDto, req.user.id, ip, userAgent);
  }

  @Get(':id/members')
  @RequirePermission('events.view')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Lista os membros de um tenant' })
  findMembers(@Param('id') id: string) {
    return this.tenantsService.findMembers(id);
  }

  @Post(':id/members')
  @RequirePermission('members.create')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Adiciona/convida um membro para o tenant' })
  addMember(
    @Param('id') id: string,
    @Body() addMemberDto: AddMemberDto,
    @Req() req: any,
  ) {
    if (req.user.email !== 'valterpcjr@gmail.com') {
      throw new ForbiddenException('Apenas o Superadmin pode convidar membros para organizações.');
    }
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.tenantsService.addMember(id, addMemberDto, req.user.id, ip, userAgent);
  }

  @Patch(':id/members/:userId')
  @RequirePermission('members.update')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Atualiza o papel de um membro do tenant' })
  updateMember(
    @Param('id') id: string,
    @Param('userId') memberUserId: string,
    @Body() updateMemberDto: UpdateMemberDto,
    @Req() req: any,
  ) {
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.tenantsService.updateMember(
      id,
      memberUserId,
      updateMemberDto,
      req.user.id,
      ip,
      userAgent,
    );
  }

  @Delete(':id/members/:userId')
  @RequirePermission('members.delete')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Remove um membro do tenant' })
  removeMember(
    @Param('id') id: string,
    @Param('userId') memberUserId: string,
    @Req() req: any,
  ) {
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.tenantsService.removeMember(id, memberUserId, req.user.id, ip, userAgent);
  }
}
