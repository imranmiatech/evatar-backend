import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { LanguageService } from '../../language/language.service';

type NotificationSocket = Socket & {
  data: {
    userId?: string;
    language?: string;
  };
};

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'notifications',
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  private readonly userSocketMap = new Map<string, Set<string>>(); // userId -> Set of socketIds

  constructor(
    private readonly jwtService: JwtService,
    private readonly languageService: LanguageService,
  ) {}

  async handleConnection(client: NotificationSocket) {
    const token = this.socketToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }

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
      this.registerSocketForUser(userId, client);
    } catch {
      client.disconnect(true);
      return;
    }

    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: NotificationSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.removeSocketMapping(client.id);
  }

  @SubscribeMessage('register_user')
  handleRegisterUser(
    @MessageBody() data: { userId: string; language?: string },
    @ConnectedSocket() client: NotificationSocket,
  ) {
    const socketUserId = this.socketUserId(client);
    if (!data?.userId || data.userId !== socketUserId) {
      throw new Error('Socket user mismatch');
    }

    if (data.language) {
      this.setSocketLanguage(client, data.language);
    }

    this.registerSocketForUser(socketUserId, client);
    this.logger.log(`User ${socketUserId} registered on socket ${client.id}`);
    return {
      event: 'registered',
      data: { userId: socketUserId, language: this.socketLanguage(client) },
    };
  }

  @SubscribeMessage('setLanguage')
  handleSetLanguage(
    @MessageBody() data: { language: string },
    @ConnectedSocket() client: NotificationSocket,
  ) {
    this.setSocketLanguage(client, data?.language);
    return {
      event: 'languageUpdated',
      data: { language: this.socketLanguage(client) },
    };
  }

  /**
   * Emit real-time notification to user's room if connected
   */
  emitNotificationToUser(userId: string, notification: any) {
    this.server.to(`user_${userId}`).emit('notification:new', notification);
  }

  /**
   * Emit updated unread count badge
   */
  emitUnreadCountToUser(userId: string, unreadCount: number) {
    this.server.to(`user_${userId}`).emit('notification:unread_count', { unreadCount });
  }

  emitNotificationReadToUser(userId: string, notificationId: string) {
    this.server
      .to(`user_${userId}`)
      .emit('notification:read', { notificationId });
  }

  emitAllNotificationsReadToUser(userId: string) {
    this.server.to(`user_${userId}`).emit('notification:read_all');
  }

  emitNotificationDeletedToUser(userId: string, notificationId: string) {
    this.server
      .to(`user_${userId}`)
      .emit('notification:deleted', { notificationId });
  }

  async fetchUserSockets(userId: string) {
    return this.server.in(`user_${userId}`).fetchSockets();
  }

  socketLanguage(client: { data: { language?: unknown } }) {
    return typeof client.data.language === 'string'
      ? client.data.language
      : undefined;
  }

  private removeSocketMapping(socketId: string) {
    for (const [userId, sockets] of this.userSocketMap.entries()) {
      if (sockets.has(socketId)) {
        sockets.delete(socketId);
        if (sockets.size === 0) {
          this.userSocketMap.delete(userId);
        }
        break;
      }
    }
  }

  private registerSocketForUser(userId: string, client: NotificationSocket) {
    if (!this.userSocketMap.has(userId)) {
      this.userSocketMap.set(userId, new Set());
    }

    this.userSocketMap.get(userId)!.add(client.id);
    client.join(`user_${userId}`);
  }

  private socketToken(client: NotificationSocket) {
    const auth = client.handshake.auth as
      | { token?: unknown; language?: unknown }
      | undefined;
    return typeof auth?.token === 'string' ? auth.token : undefined;
  }

  private socketHandshakeLanguage(client: NotificationSocket) {
    const auth = client.handshake.auth as { language?: unknown } | undefined;
    return typeof auth?.language === 'string' ? auth.language : undefined;
  }

  private socketUserId(client: NotificationSocket) {
    const userId = client.data?.userId;
    if (!userId) {
      throw new Error('Socket user is required');
    }
    return userId;
  }

  private setSocketUserId(client: NotificationSocket, userId: string) {
    client.data.userId = userId;
  }

  private setSocketLanguage(client: NotificationSocket, language?: string) {
    client.data.language = this.languageService.normalizeLanguage(language);
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
}
