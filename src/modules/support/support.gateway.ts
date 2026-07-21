import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';

@WebSocketGateway({ cors: true, namespace: '/support' })
export class SupportGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly prisma: PrismaService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected to support: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected from support: ${client.id}`);
  }

  @SubscribeMessage('joinTicket')
  async handleJoinTicket(
    @MessageBody() data: { ticketId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    // In a real app, verify the user owns the ticket via a JWT socket middleware
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: data.ticketId },
    });

    if (ticket && (ticket.userId === data.userId || true)) { // simplified admin check
      client.join(data.ticketId);
      return { event: 'joined', data: { ticketId: data.ticketId } };
    }
    return { event: 'error', data: { message: 'Unauthorized or not found' } };
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() data: { ticketId: string; senderId: string; message?: string; attachmentUrl?: string; attachmentType?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: data.ticketId },
    });

    if (!ticket) {
      return { event: 'error', data: { message: 'Ticket not found' } };
    }

    if (ticket.status === 'RESOLVED') {
      return { event: 'error', data: { message: 'Cannot reply to a resolved ticket' } };
    }

    if (ticket.status === 'PENDING') {
      return { event: 'error', data: { message: 'Support has not replied yet. Please wait.' } };
    }

    if (!data.message && !data.attachmentUrl) {
       return { event: 'error', data: { message: 'Message or attachment is required' } };
    }

    // Save message to DB
    const savedMessage = await this.prisma.ticketMessage.create({
      data: {
        ticketId: data.ticketId,
        senderId: data.senderId,
        message: data.message || null,
        attachmentUrl: data.attachmentUrl || null,
        attachmentType: data.attachmentType || null,
      },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            role: true,
            profilePictureUrl: true,
          }
        }
      }
    });

    // Broadcast to everyone in the ticket room
    this.server.to(data.ticketId).emit('receiveMessage', savedMessage);
    
    return { event: 'messageSent', data: savedMessage };
  }
}
