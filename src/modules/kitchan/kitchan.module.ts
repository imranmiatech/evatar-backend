import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { KitchanController } from './kitchan.controller';
import { KitchanService } from './kitchan.service';

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [KitchanController],
  providers: [KitchanService, JwtAuthGuard],
})
export class KitchanModule {}
