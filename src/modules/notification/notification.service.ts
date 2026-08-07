import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationQueryDto, NotificationGroupFilter } from './dto/notification-query.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { groupNotifications } from './utils/notification-grouping.util';
import { NotificationGateway } from './gateways/notification.gateway';
import { FirebaseFcmService } from './services/firebase-fcm.service';

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationGateway: NotificationGateway,
    private readonly firebaseFcmService: FirebaseFcmService,
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
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
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

    // 1. Emit Socket.io event for real-time in-app UI update
    this.notificationGateway.emitNotificationToUser(dto.userId, notification);
    this.notificationGateway.emitUnreadCountToUser(dto.userId, unreadCount);

    // 2. Dispatch FCM Push Notification to user device tokens
    const deviceTokens = await this.prisma.userDeviceToken.findMany({
      where: { userId: dto.userId },
      select: { fcmToken: true },
    });

    if (deviceTokens.length > 0) {
      const tokens = deviceTokens.map((t) => t.fcmToken);
      await this.firebaseFcmService.sendPushNotification({
        tokens,
        title: dto.title,
        body: dto.message,
        data: {
          notificationId: notification.id,
          type: dto.type,
          actionUrl: dto.actionUrl || '',
        },
      });
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
}
