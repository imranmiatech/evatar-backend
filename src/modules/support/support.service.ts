import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, Prisma, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { CreateTicketDto, SendMessageDto } from './dto/support.dto';

const supportMessageInclude = {
  sender: {
    select: {
      id: true,
      fullName: true,
      role: true,
      profilePictureUrl: true,
    },
  },
} satisfies Prisma.TicketMessageInclude;

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async createTicket(userId: string, createTicketDto: CreateTicketDto) {
    const ticket = await this.prisma.supportTicket.create({
      data: {
        userId,
        subject: createTicketDto.subject,
        message: createTicketDto.message,
        status: 'PENDING',
      },
    });

    // Notify active Admin users about new support ticket
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true },
      });
      const senderName = user?.fullName || 'A user';

      const admins = await this.prisma.user.findMany({
        where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
        select: { id: true },
      });

      for (const admin of admins) {
        await this.notificationService.createNotification({
          userId: admin.id,
          type: NotificationType.NEW_MESSAGE,
          title: 'New Support Ticket',
          message: `${senderName}: ${createTicketDto.subject}`,
          iconType: 'CHAT',
          actionText: 'View Ticket',
          actionUrl: `/support/tickets/${ticket.id}`,
          metadata: { ticketId: ticket.id, subject: createTicketDto.subject },
        });
      }
    } catch (err) {
      console.error('Failed to notify admins of support ticket:', err);
    }

    return {
      success: true,
      message: 'Ticket submitted successfully',
      data: ticket,
    };
  }

  async getMyTickets(userId: string) {
    const tickets = await this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      success: true,
      data: tickets,
    };
  }

  async getTicketMessages(userId: string, ticketId: string, role?: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: {
                id: true,
                fullName: true,
                role: true,
                profilePictureUrl: true,
              },
            },
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.userId !== userId && role !== 'ADMIN') {
      throw new ForbiddenException('Access denied');
    }

    return {
      success: true,
      data: {
        ticket: {
          id: ticket.id,
          subject: ticket.subject,
          status: ticket.status,
          createdAt: ticket.createdAt,
        },
        messages: ticket.messages,
      },
    };
  }

  async sendMessage(
    userId: string,
    role: UserRole,
    ticketId: string,
    dto: SendMessageDto,
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.userId !== userId && role !== UserRole.ADMIN) {
      throw new ForbiddenException('Access denied');
    }

    if (ticket.status !== 'REPLIED') {
      throw new BadRequestException(
        ticket.status === 'RESOLVED'
          ? 'Cannot reply to a resolved ticket'
          : 'Support chat is not open yet',
      );
    }

    if (!dto.message && !dto.attachmentUrl) {
      throw new BadRequestException('Message or attachment is required');
    }

    const savedMessage = await this.prisma.ticketMessage.create({
      data: {
        ticketId,
        senderId: userId,
        message: dto.message ?? null,
        attachmentUrl: dto.attachmentUrl ?? null,
        attachmentType: dto.attachmentType ?? null,
      },
      include: supportMessageInclude,
    });

    try {
      const senderName = savedMessage.sender?.fullName || 'Someone';
      const preview = dto.message || (dto.attachmentUrl ? 'Sent an attachment' : 'New support message');

      if (userId === ticket.userId) {
        const admins = await this.prisma.user.findMany({
          where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
          select: { id: true },
        });

        for (const admin of admins) {
          await this.notificationService.createNotification({
            userId: admin.id,
            type: NotificationType.NEW_MESSAGE,
            title: `Support reply from ${senderName}`,
            message: preview,
            iconType: 'CHAT',
            actionText: 'View Ticket',
            actionUrl: `/support/tickets/${ticketId}`,
            metadata: { ticketId },
          });
        }
      } else {
        await this.notificationService.createNotification({
          userId: ticket.userId,
          type: NotificationType.NEW_MESSAGE,
          title: `Support update: ${ticket.subject}`,
          message: preview,
          iconType: 'CHAT',
          actionText: 'View Support Reply',
          actionUrl: `/support/tickets/${ticketId}`,
          metadata: { ticketId },
        });
      }
    } catch (err) {
      console.error('Failed to notify support message:', err);
    }

    return {
      success: true,
      message: 'Message sent',
      data: savedMessage,
    };
  }

  async resolveTicket(userId: string, ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const updatedTicket = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: 'RESOLVED' },
    });

    return {
      success: true,
      message: 'Ticket marked as resolved',
      data: updatedTicket,
    };
  }

  // --- ADMIN METHODS ---

  async getAllTickets() {
    const tickets = await this.prisma.supportTicket.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          }
        }
      }
    });

    return {
      success: true,
      data: tickets,
    };
  }

  async updateTicketStatus(ticketId: string, status: 'PENDING' | 'REPLIED' | 'RESOLVED') {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const updatedTicket = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status },
    });

    try {
      await this.notificationService.createNotification({
        userId: ticket.userId,
        type: NotificationType.NEW_MESSAGE,
        title: `Support Ticket ${status}`,
        message: `Your ticket "${ticket.subject}" status is now ${status}.`,
        iconType: 'CHECK',
        actionText: 'View Ticket',
        actionUrl: `/support/tickets/${ticketId}`,
        metadata: { ticketId, status },
      });
    } catch (err) {
      console.error('Failed to notify user of ticket status update:', err);
    }

    return {
      success: true,
      message: `Ticket status updated to ${status}`,
      data: updatedTicket,
    };
  }
}
