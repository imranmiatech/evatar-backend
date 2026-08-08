import { Module } from '@nestjs/common';
import { JwtAuthModule } from '../../common/configs/jwt-auth.module';
import { LanguageModule } from '../language/language.module';
import { NotificationModule } from '../notification/notification.module';
import { MessageController } from './message.controller';
import { MessageGateway } from './message.gateway';
import { MessageService } from './message.service';

@Module({
  imports: [JwtAuthModule, NotificationModule, LanguageModule],
  controllers: [MessageController],
  providers: [MessageService, MessageGateway],
  exports: [MessageService],
})
export class MessageModule {}
