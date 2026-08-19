import { Module } from '@nestjs/common';
import { MailModule } from '../../common/mail/mail.module';
import { TwilioModule } from '../../common/twilio/twilio.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { CaregiverController } from './caregiver/caregiver.controller';
import { CaregiverService } from './caregiver/caregiver.service';
import { ChildController } from './child/child.controller';
import { ChildService } from './child/child.service';
import { InvitationController } from './invitation/invitation.controller';
import { InvitationService } from './invitation/invitation.service';
import { ManageSystemService } from './manage-system.service';

@Module({
  imports: [PrismaModule, MailModule, TwilioModule],
  controllers: [CaregiverController, ChildController, InvitationController],
  providers: [
    CaregiverService,
    ChildService,
    InvitationService,
    ManageSystemService,
  ],
  exports: [
    CaregiverService,
    ChildService,
    InvitationService,
    ManageSystemService,
  ],
})
export class ManageSystemModule {}
