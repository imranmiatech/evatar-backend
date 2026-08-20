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
import { LanguageService } from '../language/language.service';
import { MessageService } from './message.service';

type MessageSocket = Socket & {
  data: {
    userId?: string;
    language?: string;
  };
};

type JoinUserPayload = {
  userId: string;
  language?: string;
};

type JoinConversationPayload = {
  conversationId: string;
  userId: string;
  language?: string;
};

type SendMessagePayload = {
  conversationId: string;
  senderId: string;
  message?: string;
  attachmentUrl?: string;
  attachmentType?: string;
};

type SetLanguagePayload = {
  language: string;
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
    private readonly languageService: LanguageService,
  ) {}

  async handleConnection(client: MessageSocket) {
    const token = this.socketToken(client);
    if (token) {
      try {
        const payload =
          await this.jwtService.verifyAsync<Record<string, unknown>>(token);
        const userId = this.jwtUserId(payload);
        this.setSocketUserId(client, userId);
        this.setSocketLanguage(
          client,
          typeof payload.preferredLanguage === 'string'
            ? payload.preferredLanguage
            : this.socketHandshakeLanguage(client),
        );
        void client.join(`user:${userId}`);
      } catch {
        client.disconnect(true);
        return;
      }
    } else {
      this.setSocketLanguage(client, this.socketHandshakeLanguage(client));
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
    this.setSocketLanguage(client, payload.language ?? this.socketLanguage(client));
    void client.join(`user:${userId}`);
    return {
      event: 'joinedUser',
      data: { userId, language: this.socketLanguage(client) },
    };
  }

  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @MessageBody() data: unknown,
    @ConnectedSocket() client: MessageSocket,
  ) {
    try {
      const payload = this.joinConversationPayload(data);
      const userId = this.socketUserId(client, payload.userId);
      this.setSocketLanguage(client, payload.language ?? this.socketLanguage(client));
      await this.messageService.assertParticipant(
        userId,
        payload.conversationId,
      );
      void client.join(payload.conversationId);
      return {
        event: 'joinedConversation',
        data: {
          conversationId: payload.conversationId,
          language: this.socketLanguage(client),
        },
      };
    } catch (error) {
      return { event: 'error', data: { message: this.errorMessage(error) } };
    }
  }

  @SubscribeMessage('setLanguage')
  handleSetLanguage(
    @MessageBody() data: unknown,
    @ConnectedSocket() client: MessageSocket,
  ) {
    const payload = this.setLanguagePayload(data);
    this.setSocketLanguage(client, payload.language);
    return {
      event: 'languageUpdated',
      data: { language: this.socketLanguage(client) },
    };
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
      const participantUserIds =
        await this.messageService.getParticipantUserIds(payload.conversationId);
      const senderLanguage = this.socketLanguage(client);
      const senderMessage = await this.messageService.formatMessageForUser(
        senderId,
        response.data,
        senderLanguage,
      );

      await Promise.all(
        participantUserIds.map(async (userId) => {
          const sockets = await this.server.in(`user:${userId}`).fetchSockets();
          const fallbackMessage = await this.messageService.formatMessageForUser(
            userId,
            response.data,
          );

          await Promise.all(
            sockets.map(async (socket) => {
              const socketLanguage = this.remoteSocketLanguage(socket);
              const localizedMessage = socketLanguage
                ? await this.messageService.formatMessageForLanguage(
                    response.data,
                    socketLanguage,
                  )
                : fallbackMessage;

              if (socket.rooms.has(payload.conversationId)) {
                this.server.to(socket.id).emit('receiveMessage', localizedMessage);
              }

              this.server.to(socket.id).emit('conversationUpdated', {
                conversationId: payload.conversationId,
                latestMessage: localizedMessage,
              });
            }),
          );
        }),
      );

      return { event: 'messageSent', data: senderMessage };
    } catch (error) {
      return { event: 'error', data: { message: this.errorMessage(error) } };
    }
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Something went wrong';
  }

  private socketToken(client: MessageSocket) {
    const auth = client.handshake.auth as
      | { token?: unknown; language?: unknown }
      | undefined;
    return typeof auth?.token === 'string' ? auth.token : undefined;
  }

  private socketHandshakeLanguage(client: MessageSocket) {
    const auth = client.handshake.auth as { language?: unknown } | undefined;
    return typeof auth?.language === 'string' ? auth.language : undefined;
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

  private socketLanguage(client: MessageSocket) {
    const data = client.data as { language?: unknown };
    return typeof data.language === 'string' ? data.language : undefined;
  }

  private setSocketLanguage(client: MessageSocket, language?: string) {
    const data = client.data as { language?: string };
    data.language = this.languageService.normalizeLanguage(language);
  }

  private remoteSocketLanguage(socket: { data: { language?: unknown } }) {
    return typeof socket.data.language === 'string'
      ? socket.data.language
      : undefined;
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
      return {
        userId: payload.userId,
        language:
          'language' in payload && typeof payload.language === 'string'
            ? payload.language
            : undefined,
      };
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
        language:
          'language' in payload && typeof payload.language === 'string'
            ? payload.language
            : undefined,
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

  private setLanguagePayload(payload: unknown): SetLanguagePayload {
    if (
      payload &&
      typeof payload === 'object' &&
      'language' in payload &&
      typeof payload.language === 'string'
    ) {
      return { language: payload.language };
    }

    throw new Error('language is required');
  }
}
