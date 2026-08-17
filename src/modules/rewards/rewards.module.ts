import { Module } from '@nestjs/common';
import { ManageSystemModule } from '../manageSystem/manage-system.module';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';

@Module({
  imports: [ManageSystemModule],
  controllers: [RewardsController],
  providers: [RewardsService],
  exports: [RewardsService],
})
export class RewardsModule {}
