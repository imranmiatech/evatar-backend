import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AdminPartnerController } from './admin-partner.controller';
import { AdminPartnerService } from './admin-partner.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminPartnerController],
  providers: [AdminPartnerService],
})
export class AdminPartnerModule {}
