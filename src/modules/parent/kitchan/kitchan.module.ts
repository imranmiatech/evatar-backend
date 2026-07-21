import { Module } from '@nestjs/common';

import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PrismaModule } from '../../../prisma/prisma.module';
import { KitchanController } from './kitchan.controller';
import { KitchanService } from './kitchan.service';

@Module({
  imports: [PrismaModule],
  controllers: [KitchanController],
  providers: [KitchanService, JwtAuthGuard],
})
export class KitchanModule {}
