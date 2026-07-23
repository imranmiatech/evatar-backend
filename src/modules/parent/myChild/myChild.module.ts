import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PrismaModule } from '../../../prisma/prisma.module';
import { MyChildController } from './myChild.controller';
import { MyChildService } from './myChild.service';

@Module({
  imports: [PrismaModule],
  controllers: [MyChildController],
  providers: [MyChildService, JwtAuthGuard],
})
export class MyChildModule {}
