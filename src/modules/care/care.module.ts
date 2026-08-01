import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RewardsModule } from '../rewards/rewards.module';
import { CareController } from './care.controller';
import { CareService } from './care.service';

@Module({
  imports: [PrismaModule, RewardsModule],
  controllers: [CareController],
  providers: [CareService],
})
export class CareModule {}
