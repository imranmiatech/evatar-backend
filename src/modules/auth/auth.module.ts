import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TwilioModule } from '../../common/twilio/twilio.module';
import { MailModule } from '../../common/mail/mail.module';

@Module({
  imports: [
    TwilioModule, 
    MailModule
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
