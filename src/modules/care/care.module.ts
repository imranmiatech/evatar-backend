import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RewardsModule } from '../rewards/rewards.module';
import { CarehubController } from './controllers/carehub.controller';
import { CarehubInsightsController } from './controllers/carehub-insights.controller';
import { CarehubQuizController } from './controllers/carehub-quiz.controller';
import { CarehubService } from './services/carehub.service';
import { CarehubInsightsService } from './services/carehub-insights.service';
import { CarehubQuizService } from './services/carehub-quiz.service';

@Module({
  imports: [PrismaModule, RewardsModule],
  controllers: [CarehubController, CarehubInsightsController, CarehubQuizController],
  providers: [CarehubService, CarehubInsightsService, CarehubQuizService],
})
export class CareModule {}
