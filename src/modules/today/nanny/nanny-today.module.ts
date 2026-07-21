import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../../common/auth/jwt-auth.guard';
import { PrismaModule } from '../../../prisma/prisma.module';
import { NannyTodayController } from './nanny-today.controller';
import { NannyTodayService } from './nanny-today.service';

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [NannyTodayController],
  providers: [NannyTodayService, JwtAuthGuard],
  exports: [NannyTodayService],
})
export class NannyTodayModule {}
