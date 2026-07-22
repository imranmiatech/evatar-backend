import { Module } from '@nestjs/common';
import { JwtAuthModule } from '../../common/configs/jwt-auth.module';
import { MessageController } from './message.controller';
import { MessageGateway } from './message.gateway';
import { MessageService } from './message.service';

@Module({
  imports: [JwtAuthModule],
  controllers: [MessageController],
  providers: [MessageService, MessageGateway],
  exports: [MessageService],
})
export class MessageModule {}
