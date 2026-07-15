import { Module } from '@nestjs/common';
import { WorkshopsService } from './workshops.service';
import { WorkshopsController, PublicWorkshopsController } from './workshops.controller';

@Module({
  controllers: [WorkshopsController, PublicWorkshopsController],
  providers: [WorkshopsService],
  exports: [WorkshopsService],
})
export class WorkshopsModule {}
