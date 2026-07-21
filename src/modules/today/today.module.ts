import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../prisma/prisma.module';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ActivityController } from './activity/activity.controller';
import { ActivityService } from './activity/activity.service';
import { NannyTodayModule } from './nanny/nanny-today.module';
import { todayController } from './today.controller';
import { todayService } from './today.service';

@Module({
  imports: [PrismaModule, JwtModule.register({}), NannyTodayModule],
  controllers: [todayController, ActivityController],
  providers: [todayService, ActivityService, JwtAuthGuard],
})
export class todayModule {}
