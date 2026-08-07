import { IsNotEmpty, IsString, IsOptional, IsEnum, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';

export class CreateNotificationDto {
  @ApiProperty({ description: 'Target user ID receiving the notification' })
  @IsNotEmpty()
  @IsString()
  userId: string;

  @ApiProperty({ enum: NotificationType, description: 'Category of notification' })
  @IsNotEmpty()
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ description: 'Notification title header', example: 'Language Activity Completed' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ description: 'Notification detailed message', example: 'Deepa completed today\'s language learning session with Eve.' })
  @IsNotEmpty()
  @IsString()
  message: string;

  @ApiPropertyOptional({ description: 'Icon identifier type: CHECK, FOOD, CHAT, CART, BOOK, AVATAR, GIFT, INSIGHT' })
  @IsOptional()
  @IsString()
  iconType?: string;

  @ApiPropertyOptional({ description: 'Avatar image URL if applicable' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({ description: 'Action button or link label e.g. View Activity, Open Chat, Read Story' })
  @IsOptional()
  @IsString()
  actionText?: string;

  @ApiPropertyOptional({ description: 'Deeplink or route path e.g. /activities/123, /chat/456' })
  @IsOptional()
  @IsString()
  actionUrl?: string;

  @ApiPropertyOptional({ description: 'Extra metadata JSON payload' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
