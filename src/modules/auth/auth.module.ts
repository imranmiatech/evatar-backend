import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TwilioModule } from '../../common/twilio/twilio.module';
import { MailModule } from '../../common/mail/mail.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TwilioModule, 
    MailModule,
    NotificationModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
