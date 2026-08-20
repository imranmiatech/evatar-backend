import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationQueryDto, NotificationGroupFilter } from './dto/notification-query.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { groupNotifications } from './utils/notification-grouping.util';
import { NotificationGateway } from './gateways/notification.gateway';
import { FirebaseFcmService } from './services/firebase-fcm.service';
import { LanguageService } from '../language/language.service';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';

type StoredNotification = Prisma.NotificationGetPayload<Record<string, never>>;

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationGateway: NotificationGateway,
    private readonly firebaseFcmService: FirebaseFcmService,
    private readonly languageService: LanguageService,
  ) {}

  /**
   * Get User Notifications grouped dynamically (TODAY, THIS_WEEK, OLDER) matching mobile UI
   */
  async getUserNotifications(userId: string, query: NotificationQueryDto) {
    const { page = 1, limit = 20, isRead, group } = query;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (isRead !== undefined) {
      where.isRead = isRead;
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    if (group && group !== NotificationGroupFilter.ALL) {
      if (group === NotificationGroupFilter.TODAY) {
        where.createdAt = { gte: startOfToday };
      } else if (group === NotificationGroupFilter.THIS_WEEK) {
        where.createdAt = { gte: sevenDaysAgo, lt: startOfToday };
      } else if (group === NotificationGroupFilter.OLDER) {
        where.createdAt = { lt: sevenDaysAgo };
      }
    }

    const [totalItems, unreadCount, notifications] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const groupedData = groupNotifications(notifications);

    const totalPages = Math.ceil(totalItems / limit) || 1;

    return {
      unreadCount,
      totalCount: totalItems,
      groups: groupedData.groups,
      items: notifications,
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
        unreadCount,
      },
    };
  }

  /**
   * Create System Notification, push via Socket.io & FCM Push
   */
  async createNotification(dto: CreateNotificationDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, preferredLanguage: true },
    });
    if (!user) {
      throw new NotFoundException('Target user not found.');
    }

    const notification = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        iconType: dto.iconType,
        avatarUrl: dto.avatarUrl,
        actionText: dto.actionText,
        actionUrl: dto.actionUrl,
        metadata: dto.metadata,
      },
    });

    const unreadCount = await this.prisma.notification.count({
      where: { userId: dto.userId, isRead: false },
    });

    await this.emitLocalizedNotification(dto.userId, notification);
    this.notificationGateway.emitUnreadCountToUser(dto.userId, unreadCount);

    const deviceTokens = await this.prisma.userDeviceToken.findMany({
      where: { userId: dto.userId },
      select: { fcmToken: true },
    });

    if (deviceTokens.length > 0) {
      const tokens = deviceTokens.map((t) => t.fcmToken);
      const localizedNotification = await this.formatNotificationForLanguage(
        notification,
        user.preferredLanguage,
      );
      const pushResult = await this.firebaseFcmService.sendPushNotification({
        tokens,
        title: localizedNotification.title,
        body: localizedNotification.message,
        data: {
          notificationId: notification.id,
          type: dto.type,
          actionUrl: dto.actionUrl || '',
        },
      });

      if (pushResult.invalidTokens.length > 0) {
        await this.prisma.userDeviceToken.deleteMany({
          where: { fcmToken: { in: pushResult.invalidTokens } },
        });
      }
    }

    return notification;
  }

  /**
   * Mark Single Notification as Read
   */
  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found.');
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    this.notificationGateway.emitUnreadCountToUser(userId, unreadCount);
    this.notificationGateway.emitNotificationReadToUser(userId, notificationId);

    return {
      message: 'Notification marked as read',
      notification: updated,
      unreadCount,
    };
  }

  /**
   * Mark All Notifications as Read for User
   */
  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    this.notificationGateway.emitUnreadCountToUser(userId, 0);
    this.notificationGateway.emitAllNotificationsReadToUser(userId);

    return {
      message: 'All notifications marked as read',
      unreadCount: 0,
    };
  }

  /**
   * Delete Notification
   */
  async deleteNotification(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found.');
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });

    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    this.notificationGateway.emitUnreadCountToUser(userId, unreadCount);
    this.notificationGateway.emitNotificationDeletedToUser(userId, notificationId);

    return {
      message: 'Notification deleted successfully',
      notificationId,
      unreadCount,
    };
  }

  /**
   * Register or Update Mobile FCM Device Token
   */
  async registerDeviceToken(userId: string, dto: RegisterDeviceTokenDto) {
    const tokenRecord = await this.prisma.userDeviceToken.upsert({
      where: { fcmToken: dto.fcmToken },
      update: {
        userId,
        deviceType: dto.deviceType,
      },
      create: {
        userId,
        fcmToken: dto.fcmToken,
        deviceType: dto.deviceType,
      },
    });

    return {
      message: 'Device token registered successfully for push notifications',
      deviceToken: tokenRecord,
    };
  }

  /**
   * Remove FCM Device Token on Logout
   */
  async removeDeviceToken(userId: string, fcmToken: string) {
    const tokenRecord = await this.prisma.userDeviceToken.findFirst({
      where: { userId, fcmToken },
    });

    if (tokenRecord) {
      await this.prisma.userDeviceToken.delete({
        where: { id: tokenRecord.id },
      });
    }

    return {
      message: 'Device token removed successfully',
    };
  }

  /**
   * Role-based Broadcast Notification for Web Admin & Partner Panel
   */
  async broadcastNotification(
    senderUserId: string,
    dto: BroadcastNotificationDto,
  ) {
    const sender = await this.prisma.user.findUnique({
      where: { id: senderUserId },
      select: { id: true, role: true, fullName: true },
    });

    const targetRoles = dto.targetRoles?.length
      ? dto.targetRoles
      : [
          UserRole.PARENT,
          UserRole.NANNY,
          UserRole.PARTNER,
          UserRole.ADMIN,
        ];

    const targetUsers = await this.prisma.user.findMany({
      where: {
        role: { in: targetRoles },
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    const notifications = await Promise.all(
      targetUsers.map((user) =>
        this.createNotification({
          userId: user.id,
          type: dto.type,
          title: dto.title,
          message: dto.message,
          iconType: dto.iconType ?? 'BELL',
          avatarUrl: dto.avatarUrl,
          actionText: dto.actionText,
          actionUrl: dto.actionUrl,
          metadata: {
            sentByUserId: senderUserId,
            sentByRole: sender?.role,
            sentByName: sender?.fullName,
          },
        }),
      ),
    );

    return {
      success: true,
      message: `Notification broadcasted to ${notifications.length} users across targeted roles`,
      recipientCount: notifications.length,
      targetRoles,
    };
  }

  private async emitLocalizedNotification(
    userId: string,
    notification: StoredNotification,
  ) {
    const sockets = await this.notificationGateway.fetchUserSockets(userId);

    if (sockets.length === 0) {
      return;
    }

    const fallbackNotification = await this.formatNotificationForUser(
      userId,
      notification,
    );

    await Promise.all(
      sockets.map(async (socket) => {
        const socketLanguage = this.notificationGateway.socketLanguage(socket);
        const localizedNotification = socketLanguage
          ? await this.formatNotificationForLanguage(notification, socketLanguage)
          : fallbackNotification;

        this.notificationGateway.server
          .to(socket.id)
          .emit('notification:new', localizedNotification);
      }),
    );
  }

  private async formatNotificationForUser(
    userId: string,
    notification: StoredNotification,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferredLanguage: true },
    });

    return this.formatNotificationForLanguage(
      notification,
      user?.preferredLanguage,
    );
  }

  private async formatNotificationForLanguage(
    notification: StoredNotification,
    language?: string | null,
  ) {
    const normalizedLanguage = this.languageService.normalizeLanguage(language);

    return {
      ...notification,
      title: (await this.languageService.translateAsync(
        notification.title,
        normalizedLanguage,
      )) as string,
      message: (await this.languageService.translateAsync(
        notification.message,
        normalizedLanguage,
      )) as string,
      actionText: notification.actionText
        ? ((await this.languageService.translateAsync(
            notification.actionText,
            normalizedLanguage,
          )) as string)
        : notification.actionText,
    };
  }
}
