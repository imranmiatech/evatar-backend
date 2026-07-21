import { Module } from '@nestjs/common';

import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { PrismaModule } from '../../../../prisma/prisma.module';
import { NannyTodayController } from './nanny-today.controller';
import { NannyTodayService } from './nanny-today.service';

@Module({
  imports: [PrismaModule],
  controllers: [NannyTodayController],
  providers: [NannyTodayService, JwtAuthGuard],
  exports: [NannyTodayService],
})
export class NannyTodayModule {}
