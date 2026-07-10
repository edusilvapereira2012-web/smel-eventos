import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../common/redis/redis.service';
import * as webpush from 'web-push';

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private publicKey!: string;
  private privateKey!: string;

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
  ) {}

  onModuleInit() {
    this.publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY') || '';
    this.privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY') || '';

    if (!this.publicKey || !this.privateKey) {
      this.logger.warn('Chaves VAPID não configuradas. Gerando chaves temporárias para desenvolvimento...');
      const keys = webpush.generateVAPIDKeys();
      this.publicKey = keys.publicKey;
      this.privateKey = keys.privateKey;
    }

    webpush.setVapidDetails(
      'mailto:suporte@smel.gov.br',
      this.publicKey,
      this.privateKey
    );
  }

  getPublicKey() {
    return { publicKey: this.publicKey };
  }

  async subscribe(userId: string, subscription: any) {
    const key = `push:user:${userId}`;
    const existingStr = await this.redisService.get(key);
    let subscriptions: any[] = [];

    if (existingStr) {
      try {
        subscriptions = JSON.parse(existingStr);
      } catch (e) {
        subscriptions = [];
      }
    }

    const alreadyExists = subscriptions.some((s) => s.endpoint === subscription.endpoint);
    if (!alreadyExists) {
      subscriptions.push(subscription);
      await this.redisService.set(key, JSON.stringify(subscriptions));
      this.logger.log(`Nova inscrição push registrada para o usuário: ${userId}`);
    }

    return { success: true };
  }

  async removeSubscription(userId: string, endpoint: string) {
    const key = `push:user:${userId}`;
    const existingStr = await this.redisService.get(key);
    if (!existingStr) return;

    try {
      let subscriptions: any[] = JSON.parse(existingStr);
      subscriptions = subscriptions.filter((s) => s.endpoint !== endpoint);
      await this.redisService.set(key, JSON.stringify(subscriptions));
      this.logger.log(`Inscrição push removida para o usuário: ${userId}`);
    } catch (e) {
      // Ignorar erro de parsing
    }
  }

  async sendNotification(userId: string, title: string, body: string, url = '/') {
    const key = `push:user:${userId}`;
    const subscriptionsStr = await this.redisService.get(key);
    if (!subscriptionsStr) {
      return { success: false, message: 'Nenhuma inscrição push encontrada para este usuário.' };
    }

    let subscriptions: any[] = [];
    try {
      subscriptions = JSON.parse(subscriptionsStr);
    } catch (e) {
      return { success: false, message: 'Erro ao processar as inscrições do usuário.' };
    }

    const payload = JSON.stringify({ title, body, url });

    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(sub, payload);
          return { success: true };
        } catch (error: any) {
          this.logger.error(`Erro ao enviar notificação push: ${error.message}`);
          if (error.statusCode === 410 || error.statusCode === 404) {
            await this.removeSubscription(userId, sub.endpoint);
          }
          return { success: false, error: error.message };
        }
      })
    );

    return { success: true, results };
  }
}
