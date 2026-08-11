import { Module } from '@nestjs/common';
import { AdminRewardController } from './admin-reward.controller';
import { AdminRewardService } from './admin-reward.service';

@Module({
  controllers: [AdminRewardController],
  providers: [AdminRewardService],
})
export class AdminRewardModule {}
