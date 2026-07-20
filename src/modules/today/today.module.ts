import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../prisma/prisma.module';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { todayController } from './today.controller';
import { todayService } from './today.service';

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [todayController],
  providers: [todayService, JwtAuthGuard],
})
export class todayModule {}
