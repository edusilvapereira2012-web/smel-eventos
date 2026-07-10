import { Controller, Post, Get, Body, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PushService } from './push.service';
import { Public } from '../auth/guards/public.decorator';

@ApiTags('Push')
@Controller('push')
export class PushController {
  constructor(private pushService: PushService) {}

  @Get('public-key')
  @Public()
  @ApiOperation({ summary: 'Retorna a chave pública VAPID do servidor' })
  async getPublicKey() {
    return this.pushService.getPublicKey();
  }

  @Post('subscribe')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Registra a inscrição de push notification do usuário' })
  async subscribe(@Req() req: any, @Body() subscription: any) {
    const userId = req.user.id;
    return this.pushService.subscribe(userId, subscription);
  }

  @Post('send')
  @Public() // Público apenas para testes
  @ApiOperation({ summary: 'Envia uma notificação push de teste' })
  async sendNotification(
    @Body() body: { userId: string; title: string; body: string; url?: string },
  ) {
    return this.pushService.sendNotification(body.userId, body.title, body.body, body.url);
  }
}
