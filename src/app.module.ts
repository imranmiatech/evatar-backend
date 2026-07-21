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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    MailModule,
    TwilioModule,
    StorageModule,
    JwtAuthModule,
    ParentModule,
    NanyModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
