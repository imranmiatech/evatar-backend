import { Controller, Get, Patch, Post, Delete, Query, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Mobile Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get mobile user notifications grouped by TODAY, THIS_WEEK, and OLDER with unread count' })
  @ApiResponse({ status: 200, description: 'Returns grouped notifications and unread count.' })
  async getUserNotifications(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: NotificationQueryDto,
  ) {
    const userId = user.userId || user.id!;
    return this.notificationService.getUserNotifications(userId, query);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read for current user' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read.' })
  async markAllAsRead(@CurrentUser() user: CurrentUserPayload) {
    const userId = user.userId || user.id!;
    return this.notificationService.markAllAsRead(userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark single notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read.' })
  async markAsRead(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const userId = user.userId || user.id!;
    return this.notificationService.markAsRead(userId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiResponse({ status: 200, description: 'Notification deleted.' })
  async deleteNotification(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const userId = user.userId || user.id!;
    return this.notificationService.deleteNotification(userId, id);
  }

  @Post('device-token')
  @ApiOperation({ summary: 'Register FCM device token for mobile push notifications' })
  @ApiResponse({ status: 201, description: 'FCM device token registered.' })
  async registerDeviceToken(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    const userId = user.userId || user.id!;
    return this.notificationService.registerDeviceToken(userId, dto);
  }

  @Delete('device-token')
  @ApiOperation({ summary: 'Remove FCM device token on logout' })
  @ApiResponse({ status: 200, description: 'Device token removed.' })
  async removeDeviceToken(
    @CurrentUser() user: CurrentUserPayload,
    @Body('fcmToken') fcmToken: string,
  ) {
    const userId = user.userId || user.id!;
    return this.notificationService.removeDeviceToken(userId, fcmToken);
  }

  @Post('send-test')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin Test endpoint: Create a test notification with Socket & FCM push' })
  @ApiResponse({ status: 201, description: 'Notification created and dispatched.' })
  async sendTestNotification(@Body() dto: CreateNotificationDto) {
    return this.notificationService.createNotification(dto);
  }
}
