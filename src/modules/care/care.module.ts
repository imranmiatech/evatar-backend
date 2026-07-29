import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CareController } from './care.controller';
import { CareService } from './care.service';

@Module({
  imports: [PrismaModule],
  controllers: [CareController],
  providers: [CareService],
})
export class CareModule {}
