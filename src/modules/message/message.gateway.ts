import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { MessageService } from './message.service';

type MessageSocket = Socket & {
  data: {
    userId?: string;
  };
};

type JoinUserPayload = {
  userId: string;
};

type JoinConversationPayload = {
  conversationId: string;
  userId: string;
};

type SendMessagePayload = {
  conversationId: string;
  senderId: string;
  message?: string;
  attachmentUrl?: string;
  attachmentType?: string;
};

@WebSocketGateway({ cors: true, namespace: '/messages' })
export class MessageGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly messageService: MessageService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: MessageSocket) {
    const token = this.socketToken(client);
    if (token) {
      try {
        const payload =
          await this.jwtService.verifyAsync<Record<string, unknown>>(token);
        const userId = this.jwtUserId(payload);
        this.setSocketUserId(client, userId);
        void client.join(`user:${userId}`);
      } catch {
        client.disconnect(true);
        return;
      }
    }

    console.log(`Client connected to messages: ${client.id}`);
  }

  handleDisconnect(client: MessageSocket) {
    console.log(`Client disconnected from messages: ${client.id}`);
  }

  @SubscribeMessage('joinUser')
  handleJoinUser(
    @MessageBody() data: unknown,
    @ConnectedSocket() client: MessageSocket,
  ) {
    const payload = this.joinUserPayload(data);
    const userId = this.socketUserId(client, payload.userId);
    void client.join(`user:${userId}`);
    return { event: 'joinedUser', data: { userId } };
  }

  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @MessageBody() data: unknown,
    @ConnectedSocket() client: MessageSocket,
  ) {
    try {
      const payload = this.joinConversationPayload(data);
      const userId = this.socketUserId(client, payload.userId);
      await this.messageService.assertParticipant(
        userId,
        payload.conversationId,
      );
      void client.join(payload.conversationId);
      return {
        event: 'joinedConversation',
        data: { conversationId: payload.conversationId },
      };
    } catch (error) {
      return { event: 'error', data: { message: this.errorMessage(error) } };
    }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() data: unknown,
    @ConnectedSocket() client: MessageSocket,
  ) {
    try {
      const payload = this.sendMessagePayload(data);
      const senderId = this.socketUserId(client, payload.senderId);
      const response = await this.messageService.sendMessage(
        senderId,
        payload.conversationId,
        {
          message: payload.message,
          attachmentUrl: payload.attachmentUrl,
          attachmentType: payload.attachmentType,
        },
      );

      void client.join(payload.conversationId);
      this.server
        .to(payload.conversationId)
        .emit('receiveMessage', response.data);

      const participantUserIds =
        await this.messageService.getParticipantUserIds(payload.conversationId);

      participantUserIds.forEach((userId) => {
        this.server.to(`user:${userId}`).emit('conversationUpdated', {
          conversationId: payload.conversationId,
          latestMessage: response.data,
        });
      });

      return { event: 'messageSent', data: response.data };
    } catch (error) {
      return { event: 'error', data: { message: this.errorMessage(error) } };
    }
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Something went wrong';
  }

  private socketToken(client: MessageSocket) {
    const auth = client.handshake.auth as { token?: unknown } | undefined;
    return typeof auth?.token === 'string' ? auth.token : undefined;
  }

  private socketUserId(client: MessageSocket, fallbackUserId?: string) {
    const data = client.data as { userId?: unknown };
    const userId =
      typeof data.userId === 'string' ? data.userId : fallbackUserId;

    if (!userId) {
      throw new Error('Socket user is required');
    }

    return userId;
  }

  private setSocketUserId(client: MessageSocket, userId: string) {
    const data = client.data as { userId?: string };
    data.userId = userId;
  }

  private jwtUserId(payload: unknown) {
    if (
      payload &&
      typeof payload === 'object' &&
      'sub' in payload &&
      typeof payload.sub === 'string'
    ) {
      return payload.sub;
    }

    throw new Error('Invalid socket token');
  }

  private joinUserPayload(payload: unknown): JoinUserPayload {
    if (
      payload &&
      typeof payload === 'object' &&
      'userId' in payload &&
      typeof payload.userId === 'string'
    ) {
      return { userId: payload.userId };
    }

    throw new Error('userId is required');
  }

  private joinConversationPayload(payload: unknown): JoinConversationPayload {
    if (
      payload &&
      typeof payload === 'object' &&
      'conversationId' in payload &&
      typeof payload.conversationId === 'string' &&
      'userId' in payload &&
      typeof payload.userId === 'string'
    ) {
      return {
        conversationId: payload.conversationId,
        userId: payload.userId,
      };
    }

    throw new Error('conversationId and userId are required');
  }

  private sendMessagePayload(payload: unknown): SendMessagePayload {
    if (
      payload &&
      typeof payload === 'object' &&
      'conversationId' in payload &&
      typeof payload.conversationId === 'string' &&
      'senderId' in payload &&
      typeof payload.senderId === 'string'
    ) {
      return {
        conversationId: payload.conversationId,
        senderId: payload.senderId,
        message:
          'message' in payload && typeof payload.message === 'string'
            ? payload.message
            : undefined,
        attachmentUrl:
          'attachmentUrl' in payload &&
          typeof payload.attachmentUrl === 'string'
            ? payload.attachmentUrl
            : undefined,
        attachmentType:
          'attachmentType' in payload &&
          typeof payload.attachmentType === 'string'
            ? payload.attachmentType
            : undefined,
      };
    }

    throw new Error('conversationId and senderId are required');
  }
}
