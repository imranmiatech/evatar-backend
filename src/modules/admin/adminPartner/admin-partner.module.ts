import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { MailModule } from '../../../common/mail/mail.module';
import { AdminOfferService } from './admin-offer/admin-offer.service';
import { AdminPartnerController } from './admin-partner.controller';
import { AdminPartnerService } from './admin-partner.service';

@Module({
  imports: [PrismaModule, MailModule],
  controllers: [AdminPartnerController],
  providers: [AdminPartnerService, AdminOfferService],
})
export class AdminPartnerModule {}
