import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CheckInService } from './checkin.service';
import { CheckInController } from './checkin.controller';
import { CheckInGateway } from './checkin.gateway';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { GatewayModule } from '../../gateways/gateway.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    JwtModule,
    GatewayModule,
  ],
  controllers: [CheckInController],
  providers: [CheckInService, CheckInGateway],
  exports: [CheckInService],
})
export class CheckInModule {}
