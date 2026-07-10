import { Controller, Post, Get, Body, Req, Res, UseGuards, Query, Headers, BadRequestException } from '@nestjs/common';
import * as express from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Public } from './guards/public.decorator';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { SkipTenant } from '../../common/tenant/skip-tenant.decorator';

@ApiTags('Auth')
@Controller('auth')
@SkipTenant()
export class AuthController {
  constructor(private authService: AuthService) {}

  private setCookie(res: express.Response, token: string) {
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    });
  }

  private clearCookie(res: express.Response) {
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Cadastra um novo usuário no sistema' })
  @ApiResponse({ status: 201, description: 'Usuário cadastrado com sucesso. E-mail de verificação enviado.' })
  @ApiResponse({ status: 400, description: 'Dados de entrada inválidos ou e-mail indisponível.' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @ApiOperation({ summary: 'Realiza o login de um usuário' })
  @ApiResponse({ status: 200, description: 'Login bem-sucedido. Retorna o access_token e grava o refresh_token no cookie.' })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas ou e-mail não verificado.' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    const tokens = await this.authService.login(dto, ip, userAgent);
    this.setCookie(res, tokens.refresh_token);
    return { access_token: tokens.access_token };
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @ApiOperation({ summary: 'Renova o access_token usando o refresh_token do cookie' })
  @ApiResponse({ status: 200, description: 'Token renovado com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token de atualização inválido ou expirado.' })
  async refresh(
    @Req() req: any,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    // req.user é preenchido pelo JwtRefreshStrategy
    const userId = req.user.id;
    const tokenId = req.user.tokenId;
    const tokens = await this.authService.refresh(userId, tokenId);
    this.setCookie(res, tokens.refresh_token);
    return { access_token: tokens.access_token };
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('logout')
  @ApiOperation({ summary: 'Desconecta o usuário invalidando o refresh_token' })
  @ApiResponse({ status: 200, description: 'Logout realizado com sucesso.' })
  async logout(
    @Req() req: any,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const userId = req.user.id;
    const tokenId = req.user.tokenId;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    await this.authService.logout(userId, tokenId, ip, userAgent);
    this.clearCookie(res);
    return { success: true };
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('forgot-password')
  @ApiOperation({ summary: 'Gera um token e envia um e-mail de recuperação de senha' })
  @ApiResponse({ status: 200, description: 'Se o e-mail existir, um link de recuperação foi enfileirado.' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() req: express.Request,
  ) {
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.authService.forgotPassword(dto, ip, userAgent);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Valida o token e define uma nova senha para o usuário' })
  @ApiResponse({ status: 200, description: 'Senha redefinida com sucesso.' })
  @ApiResponse({ status: 400, description: 'Token inválido ou expirado.' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: express.Request,
  ) {
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.authService.resetPassword(dto, ip, userAgent);
  }

  @Public()
  @Get('verify-email')
  @ApiOperation({ summary: 'Valida o e-mail de um usuário usando o token enviado' })
  @ApiResponse({ status: 200, description: 'E-mail verificado com sucesso.' })
  @ApiResponse({ status: 400, description: 'Token de verificação inválido ou expirado.' })
  async verifyEmail(
    @Query('token') token: string,
    @Req() req: express.Request,
  ) {
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.authService.verifyEmail(token, ip, userAgent);
  }

  @Get('me')
  @ApiOperation({ summary: 'Retorna os dados do usuário atualmente autenticado' })
  @ApiResponse({ status: 200, description: 'Dados do usuário autenticado.' })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  async getMe(@Req() req: any) {
    // req.user é preenchido pelo JwtStrategy
    return this.authService.getMe(req.user.id);
  }

  @Get('me/permissions')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'ID do Tenant ativo' })
  @ApiOperation({ summary: 'Retorna as permissões do usuário no tenant informado' })
  @ApiResponse({ status: 200, description: 'Lista de permissões do usuário.' })
  async getPermissions(
    @Req() req: any,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant context missing. X-Tenant-ID header is required.');
    }
    return this.authService.getPermissions(req.user.id, tenantId);
  }
}
