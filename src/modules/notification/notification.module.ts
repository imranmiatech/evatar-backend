import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './gateways/notification.gateway';
import { FirebaseFcmService } from './services/firebase-fcm.service';

@Module({
  imports: [PrismaModule],
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
