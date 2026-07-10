import { Module } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { EmailModule } from '../email/email.module';
import { RedisModule } from '../../common/redis/redis.module';

@Module({
  imports: [
    EmailModule,
    RedisModule,
  ],
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
