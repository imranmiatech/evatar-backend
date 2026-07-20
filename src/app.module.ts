import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { MailModule } from './modules/mail/mail.module';
import { TwilioModule } from './modules/twilio/twilio.module';
import { todayModule } from './modules/today/today.module';
import { KitchanModule } from './modules/kitchan/kitchan.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    MailModule,
    TwilioModule,
    todayModule,
    KitchanModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
