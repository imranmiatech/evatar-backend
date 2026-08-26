import { forwardRef, Module } from '@nestjs/common';
import { MembershipModule } from '../membership/membership.module';
import { ManageSystemModule } from '../manageSystem/manage-system.module';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';

@Module({
  imports: [ManageSystemModule, forwardRef(() => MembershipModule)],
  controllers: [RewardsController],
  providers: [RewardsService],
  exports: [RewardsService],
})
export class RewardsModule {}
