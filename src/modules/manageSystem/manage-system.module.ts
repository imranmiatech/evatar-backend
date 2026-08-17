import { Module } from '@nestjs/common';
import { MailModule } from '../../common/mail/mail.module';
import { TwilioModule } from '../../common/twilio/twilio.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ManageSystemController } from './manage-system.controller';
import { ManageSystemService } from './manage-system.service';

@Module({
  imports: [PrismaModule, MailModule, TwilioModule],
  controllers: [ManageSystemController],
  providers: [ManageSystemService],
  exports: [ManageSystemService],
})
export class ManageSystemModule {}
