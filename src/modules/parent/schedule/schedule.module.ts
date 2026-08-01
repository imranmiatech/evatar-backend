import { Module } from '@nestjs/common';
import { CaregiverModule } from '../../caregiver/caregiver.module';
import { ScheduleController } from './controllers/schedule.controller';
import { ScheduleService } from './services/schedule.service';

@Module({
  imports: [CaregiverModule],
  controllers: [ScheduleController],
  providers: [ScheduleService],
})
export class ScheduleModule {}
