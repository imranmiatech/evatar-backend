import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

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

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.removeSocketMapping(client.id);
  }

  @SubscribeMessage('register_user')
  handleRegisterUser(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.userId) return;
    
    if (!this.userSocketMap.has(data.userId)) {
      this.userSocketMap.set(data.userId, new Set());
    }
    this.userSocketMap.get(data.userId)!.add(client.id);
    client.join(`user_${data.userId}`);
    this.logger.log(`User ${data.userId} registered on socket ${client.id}`);
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
}
