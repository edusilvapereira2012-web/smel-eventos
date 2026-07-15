import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { SuperadminController } from './superadmin.controller';
import { SuperadminService } from './superadmin.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'email' }),
  ],
  controllers: [SuperadminController],
  providers: [SuperadminService],
})
export class SuperadminModule {}

