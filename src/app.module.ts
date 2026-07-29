import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { MailModule } from './common/mail/mail.module';
import { TwilioModule } from './common/twilio/twilio.module';
import { StorageModule } from './common/storage/storage.module';
import { JwtAuthModule } from './common/configs/jwt-auth.module';
import { ParentModule } from './modules/parent/parent.module';
import { NanyModule } from './modules/nany/nany.module';
import { AdminModule } from './modules/admin/admin.module';
import { UserModule } from './modules/user/user.module';
import { SettingModule } from './modules/setting/setting.module';
import { SupportModule } from './modules/support/support.module';
import { MessageModule } from './modules/message/message.module';
import { LibraryModule } from './modules/shared/library/library.module';
import { LanguageModule } from './modules/language/language.module';
import { KycModule } from './modules/kyc/kyc.module';
import { NannyFeedbackModule } from './modules/nannyfeedback/nannyfeedback.module';
import { CareModule } from './modules/care/care.module';
import { ProfileModule } from './modules/profile/profile.module';

import { CaregiverModule } from './modules/caregiver/caregiver.module';
import { ScheduleModule } from './modules/parent/schedule/schedule.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    MailModule,
    TwilioModule,
    StorageModule,
    JwtAuthModule,
    NanyModule,
    AdminModule,
    UserModule,
    SettingModule,
    SupportModule,
    MessageModule,
    LanguageModule,
    KycModule,
    ParentModule,
    ScheduleModule,
    CaregiverModule,
    LibraryModule,
    NannyFeedbackModule,
    CareModule,
    ProfileModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
