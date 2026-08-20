import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, Prisma, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { LanguageService } from '../language/language.service';
import { CreateConversationDto, SendChatMessageDto } from './dto/message.dto';

const CHAT_ROLES: UserRole[] = [
  UserRole.PARENT,
  UserRole.NANNY,
  UserRole.PARTNER,
  UserRole.ADMIN,
];

const userSelect = {
  id: true,
  fullName: true,
  role: true,
  profilePictureUrl: true,
  preferredLanguage: true,
} satisfies Prisma.UserSelect;

const messageInclude = {
  sender: {
    select: userSelect,
  },
} satisfies Prisma.ChatMessageInclude;

type ChatMessageWithSender = Prisma.ChatMessageGetPayload<{
  include: typeof messageInclude;
}>;

type ConversationWithLatestMessage = Prisma.ConversationGetPayload<{
  include: ReturnType<MessageService['conversationInclude']>;
}>;

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly languageService: LanguageService,
  ) {}

  async getContacts(currentUserId: string) {
    const users = await this.prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        status: UserStatus.ACTIVE,
        role: { in: CHAT_ROLES },
      },
      select: userSelect,
      orderBy: { fullName: 'asc' },
    });

    return { success: true, data: users };
  }

  async createConversation(userId: string, dto: CreateConversationDto) {
    this.logger.log(`createConversation called — userId: "${userId}" dto: ${JSON.stringify(dto)}`);
    if (!userId) {
      throw new ForbiddenException('Valid authentication token is required to create a conversation');
    }

    // Filter out any undefined/null/empty values before passing to Prisma
    const participantIds = [
      ...new Set([userId, ...dto.participantIds].filter((id): id is string => !!id)),
    ];

    if (participantIds.length < 2) {
      throw new BadRequestException(
        'At least one other participant is required',
      );
    }

    const participants = await this.prisma.user.findMany({
      where: {
        id: { in: participantIds },
        status: UserStatus.ACTIVE,
        role: { in: CHAT_ROLES },
      },
      select: { id: true },
    });

    if (participants.length !== participantIds.length) {
      throw new BadRequestException(
        'All participants must be active parent, nanny, family member, or admin users',
      );
    }

    const existingConversations = await this.prisma.conversation.findMany({
      where: {
        AND: participantIds.map((pId) => ({
          participants: { some: { userId: pId } },
        })),
      },
      include: this.conversationInclude(),
    });

    const exactMatch = existingConversations.find(
      (c) => c.participants.length === participantIds.length,
    );

    if (exactMatch) {
      return {
        success: true,
        message: 'Conversation retrieved',
        data: exactMatch,
      };
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        title: dto.title,
        createdById: userId,
        participants: {
          create: participantIds.map((participantId) => ({
            userId: participantId,
          })),
        },
      },
      include: this.conversationInclude(),
    });

    return {
      success: true,
      message: 'Conversation created',
      data: conversation,
    };
  }

  async getConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId },
        },
      },
      include: this.conversationInclude(),
      orderBy: { updatedAt: 'desc' },
    });

    const data = await Promise.all(
      conversations.map((conversation) =>
        this.toConversationListItem(userId, conversation),
      ),
    );

    return { success: true, data };
  }

  async getMessages(userId: string, conversationId: string) {
    await this.assertParticipant(userId, conversationId);

    const messages = await this.prisma.chatMessage.findMany({
      where: { conversationId },
      include: messageInclude,
      orderBy: { createdAt: 'asc' },
    });

    await this.markAsRead(userId, conversationId);

    const messagesWithTranslation = await Promise.all(
      messages.map((msg) => this.formatMessageForUser(userId, msg)),
    );

    return { success: true, data: messagesWithTranslation };
  }

  async sendMessage(
    userId: string,
    conversationId: string,
    dto: SendChatMessageDto,
  ) {
    await this.assertParticipant(userId, conversationId);

    if (!dto.message && !dto.attachmentUrl) {
      throw new BadRequestException('Message or attachment is required');
    }

    const savedMessage = await this.prisma.chatMessage.create({
      data: {
        conversationId,
        senderId: userId,
        message: dto.message ?? null,
        attachmentUrl: dto.attachmentUrl ?? null,
        attachmentType: dto.attachmentType ?? null,
      },
      include: messageInclude,
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    const participantUserIds = await this.getParticipantUserIds(conversationId);
    const recipientIds = participantUserIds.filter((pId) => pId !== userId);
    const senderName = savedMessage.sender?.fullName || 'Someone';
    const preview = dto.message || (dto.attachmentUrl ? 'Sent an attachment' : 'New message');

    for (const recipientId of recipientIds) {
      try {
        await this.notificationService.createNotification({
          userId: recipientId,
          type: NotificationType.NEW_MESSAGE,
          title: `New message from ${senderName}`,
          message: preview,
          iconType: 'CHAT',
          avatarUrl: savedMessage.sender?.profilePictureUrl || undefined,
          actionText: 'Open Chat',
          actionUrl: `/mobile-messages.html?conversationId=${conversationId}`,
          metadata: {
            conversationId,
            senderId: userId,
            messageId: savedMessage.id,
          },
        });
      } catch (err) {
        this.logger.error(
          `Failed to create notification for recipient ${recipientId}: ${err?.message || err}`,
        );
      }
    }

    return { success: true, message: 'Message sent', data: savedMessage };
  }

  async markAsRead(userId: string, conversationId: string) {
    await this.assertParticipant(userId, conversationId);

    await this.prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: { lastReadAt: new Date() },
    });

    return { success: true, message: 'Conversation marked as read' };
  }

  async formatMessageForUser(
    userId: string,
    message: ChatMessageWithSender,
    language?: string | null,
  ) {
    const resolvedLanguage = language ?? (await this.userPreferredLanguage(userId));
    return this.formatMessageForLanguage(message, resolvedLanguage);
  }

  async formatMessageForLanguage(
    message: ChatMessageWithSender,
    language?: string | null,
  ) {
    const normalizedLanguage = this.languageService.normalizeLanguage(language);
    let translatedMessage = message.message;

    if (message.message) {
      translatedMessage = (await this.languageService.translateAsync(
        message.message,
        normalizedLanguage,
      )) as string;
    }

    return {
      ...message,
      translatedMessage: translatedMessage ?? message.message,
    };
  }

  async getParticipantUserIds(conversationId: string) {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    });

    return participants.map((participant) => participant.userId);
  }

  async assertParticipant(userId: string, conversationId: string) {
    if (!userId) {
      throw new ForbiddenException('User authentication is required');
    }

    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!participant) {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { id: true },
      });

      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      throw new ForbiddenException('Access denied');
    }

    return participant;
  }

  private conversationInclude() {
    return {
      participants: {
        include: {
          user: {
            select: userSelect,
          },
        },
      },
      messages: {
        take: 1,
        orderBy: { createdAt: 'desc' as const },
        include: messageInclude,
      },
    };
  }

  private async toConversationListItem(
    userId: string,
    conversation: ConversationWithLatestMessage,
  ) {
    const participant = conversation.participants.find(
      (item) => item.userId === userId,
    );
    const unreadCount = await this.prisma.chatMessage.count({
      where: {
        conversationId: conversation.id,
        senderId: { not: userId },
        ...(participant?.lastReadAt
          ? { createdAt: { gt: participant.lastReadAt } }
          : {}),
      },
    });

    const { messages: latestMessages, ...rest } = conversation;
    const [latestMessage] = latestMessages;
    let formattedLatestMessage: any = latestMessage ?? null;

    if (latestMessage?.message) {
      formattedLatestMessage = await this.formatMessageForUser(
        userId,
        latestMessage,
      );
    }

    return {
      ...rest,
      latestMessage: formattedLatestMessage,
      unreadCount,
    };
  }

  private async userPreferredLanguage(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferredLanguage: true },
    });

    return user?.preferredLanguage;
  }
}
