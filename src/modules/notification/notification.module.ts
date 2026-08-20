import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { JwtAuthModule } from '../../common/configs/jwt-auth.module';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './gateways/notification.gateway';
import { FirebaseFcmService } from './services/firebase-fcm.service';
import { LanguageModule } from '../language/language.module';

@Module({
  imports: [PrismaModule, JwtAuthModule, LanguageModule],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationGateway,
    FirebaseFcmService,
  ],
  exports: [
    NotificationService,
    NotificationGateway,
    FirebaseFcmService,
  ],
})
export class NotificationModule {}
