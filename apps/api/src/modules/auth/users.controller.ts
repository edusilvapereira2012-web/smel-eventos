import { Controller, Get, Delete, Body, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import * as express from 'express';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private authService: AuthService) {}

  @Get('me/export')
  @ApiOperation({ summary: 'Exporta os dados pessoais do usuário autenticado (LGPD)' })
  @ApiResponse({ status: 200, description: 'Dados pessoais exportados com sucesso.' })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  async exportUserData(@Req() req: any) {
    const userId = req.user.id;
    return this.authService.exportUserData(userId);
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exclui/anonimiza a conta do usuário autenticado (LGPD - Direito ao Esquecimento)' })
  @ApiResponse({ status: 200, description: 'Conta excluída e dados anonimizados com sucesso.' })
  @ApiResponse({ status: 400, description: 'Dados de confirmação inválidos.' })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  async deleteAccount(
    @Req() req: any,
    @Body() body: { confirm: string },
  ) {
    const userId = req.user.id;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.authService.deleteUserAccount(userId, body?.confirm, ip, userAgent);
  }
}
