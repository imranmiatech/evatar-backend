import { Module } from '@nestjs/common';
import { CaregiverModule } from '../caregiver/caregiver.module';
import {
  PartnerRewardsController,
  RewardsController,
} from './rewards.controller';
import { RewardsService } from './rewards.service';

@Module({
  imports: [CaregiverModule],
  controllers: [RewardsController, PartnerRewardsController],
  providers: [RewardsService],
  exports: [RewardsService],
})
export class RewardsModule {}
