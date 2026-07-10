import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { envSchema } from './config/env.schema';
import { PinoLoggerService } from './common/logger/pino.service';
import { EmailProcessor } from './processors/email.processor';
import { CertificatesProcessor } from './processors/certificates.processor';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => {
        const result = envSchema.safeParse(config);
        if (!result.success) {
          console.error('❌ Worker: Invalid environment variables:', result.error.format());
          throw new Error('Worker: Invalid environment variables');
        }
        return result.data;
      },
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: configService.get<string>('REDIS_URL'),
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: 'email' },
      { name: 'email-dead' },
      { name: 'certificates' },
    ),
  ],
  providers: [PinoLoggerService, EmailProcessor, CertificatesProcessor],
})
export class AppModule {}
