import { Module } from '@nestjs/common';
import { ManageSystemModule } from '../../manageSystem/manage-system.module';
import { ScheduleController } from './controllers/schedule.controller';
import { ScheduleService } from './services/schedule.service';

@Module({
  imports: [ManageSystemModule],
  controllers: [ScheduleController],
  providers: [ScheduleService],
})
export class ScheduleModule {}
