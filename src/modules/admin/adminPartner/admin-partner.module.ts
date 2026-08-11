import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { MailModule } from '../../../common/mail/mail.module';
import { AdminPartnerController } from './admin-partner.controller';
import { AdminPartnerService } from './admin-partner.service';

@Module({
  imports: [PrismaModule, MailModule],
  controllers: [AdminPartnerController],
  providers: [AdminPartnerService],
})
export class AdminPartnerModule {}
