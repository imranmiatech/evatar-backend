import { Module } from '@nestjs/common';
import { MailModule } from '../../common/mail/mail.module';
import { TwilioModule } from '../../common/twilio/twilio.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { CaregiverController } from './caregiver.controller';
import { CaregiverService } from './caregiver.service';
import { PermissionController } from './permission/permission.controller';
import { PermissionService } from './permission/permission.service';

@Module({
  imports: [PrismaModule, MailModule, TwilioModule],
  controllers: [CaregiverController, PermissionController],
  providers: [CaregiverService, PermissionService],
  exports: [CaregiverService],
})
export class CaregiverModule {}
