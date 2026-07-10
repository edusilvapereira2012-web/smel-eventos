import { Module } from '@nestjs/common';
import { RegistrationsService } from './registrations.service';
import { RegistrationsController } from './registrations.controller';
import { PublicRegistrationsController } from './public-registrations.controller';
import { EmailModule } from '../email/email.module';
import { GatewayModule } from '../../gateways/gateway.module';

@Module({
  imports: [
    EmailModule,
    GatewayModule,
  ],
  controllers: [RegistrationsController, PublicRegistrationsController],
  providers: [RegistrationsService],
  exports: [RegistrationsService],
})
export class RegistrationsModule {}
