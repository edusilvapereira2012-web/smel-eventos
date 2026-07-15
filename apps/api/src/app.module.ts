import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { envSchema } from './config/env.schema';
import { PrismaModule } from './prisma/prisma.module';
import { PinoLoggerService } from './common/logger/pino.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisModule } from './common/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { TenantInterceptor } from './common/tenant/tenant.interceptor';
import { PermissionGuard } from './common/rbac/permission.guard';
import { UploadModule } from './modules/upload/upload.module';
import { EventsModule } from './modules/events/events.module';
import { RegistrationsModule } from './modules/registrations/registrations.module';
import { QrcodeModule } from './modules/qrcode/qrcode.module';
import { CheckInModule } from './modules/checkin/checkin.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { EmailModule } from './modules/email/email.module';
import { GatewayModule } from './gateways/gateway.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { PushModule } from './modules/push/push.module';
import { SuperadminModule } from './modules/superadmin/superadmin.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { WorkshopsModule } from './modules/workshops/workshops.module';

@Module({
  imports: [
    SuperadminModule,
    EmailModule,
    CertificatesModule,
    AuditLogModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => {
        const result = envSchema.safeParse(config);
        if (!result.success) {
          console.error('❌ Invalid environment variables:', result.error.format());
          throw new Error('Invalid environment variables');
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
    PrismaModule,
    RedisModule,
    AuthModule,
    TenantsModule,
    UploadModule,
    EventsModule,
    RegistrationsModule,
    WorkshopsModule,
    QrcodeModule,
    CheckInModule,
    GatewayModule,
    DashboardModule,
    ReportsModule,
    JobsModule,
    PushModule,
    ThrottlerModule.forRoot([
      {
        name: 'public',
        ttl: 60000,
        limit: process.env.NODE_ENV === 'development' ? 1000 : 30,
      },
      {
        name: 'auth',
        ttl: 60000,
        limit: process.env.NODE_ENV === 'development' ? 5000 : 100,
      },
      {
        name: 'checkin',
        ttl: 60000,
        limit: process.env.NODE_ENV === 'development' ? 5000 : 60,
      },
    ]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PinoLoggerService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
  exports: [PinoLoggerService],
})
export class AppModule {}
