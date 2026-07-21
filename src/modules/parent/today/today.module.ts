import { Module } from '@nestjs/common';

import { PrismaModule } from '../../../prisma/prisma.module';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { ActivityController } from './activity/activity.controller';
import { ActivityService } from './activity/activity.service';
import { NannyTodayModule } from './nanny/nanny-today.module';
import { todayController } from './today.controller';
import { todayService } from './today.service';

@Module({
  imports: [PrismaModule, NannyTodayModule],
  controllers: [todayController, ActivityController],
  providers: [todayService, ActivityService, JwtAuthGuard],
})
export class todayModule {}
