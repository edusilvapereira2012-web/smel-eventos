import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EventsGateway } from './events.gateway';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule,
  ],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class GatewayModule {}
