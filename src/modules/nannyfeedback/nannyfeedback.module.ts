import { Module } from '@nestjs/common';
import { ManageSystemModule } from '../manageSystem/manage-system.module';
import { MembershipModule } from '../membership/membership.module';
import { RewardsModule } from '../rewards/rewards.module';
import { NannyFeedbackController } from './nannyfeedback.controller';
import { NannyFeedbackService } from './nannyfeedback.service';

@Module({
  imports: [ManageSystemModule, RewardsModule, MembershipModule],
  controllers: [NannyFeedbackController],
  providers: [NannyFeedbackService],
})
export class NannyFeedbackModule {}
