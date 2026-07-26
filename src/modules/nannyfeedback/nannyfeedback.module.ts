import { Module } from '@nestjs/common';
import { CaregiverModule } from '../caregiver/caregiver.module';
import { NannyFeedbackController } from './nannyfeedback.controller';
import { NannyFeedbackService } from './nannyfeedback.service';

@Module({
  imports: [CaregiverModule],
  controllers: [NannyFeedbackController],
  providers: [NannyFeedbackService],
})
export class NannyFeedbackModule {}
