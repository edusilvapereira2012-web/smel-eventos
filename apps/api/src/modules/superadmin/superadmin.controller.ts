import { Controller, Get, Post, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SuperadminService } from './superadmin.service';
import { SuperadminGuard } from '../../common/guards/superadmin.guard';
import { SkipTenant } from '../../common/tenant/skip-tenant.decorator';

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
}
