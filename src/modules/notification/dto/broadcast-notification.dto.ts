import { IsNotEmpty, IsString, IsOptional, IsEnum, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType, UserRole } from '@prisma/client';

export class BroadcastNotificationDto {
  @ApiPropertyOptional({
    enum: UserRole,
    isArray: true,
    description: 'Target roles to broadcast to (e.g. PARENT, NANNY, PARTNER, ADMIN). If omitted, broadcasts to all active users.',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(UserRole, { each: true })
  targetRoles?: UserRole[];

  @ApiProperty({ enum: NotificationType, description: 'Category of notification', example: NotificationType.PARTNER_OFFER })
  @IsNotEmpty()
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ description: 'Notification title header', example: 'New Partner Deal Available' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ description: 'Notification detailed message', example: 'Carrefour 30 AED discount offer is now live in the Rewards Hub.' })
  @IsNotEmpty()
  @IsString()
  message: string;

  @ApiPropertyOptional({ description: 'Icon identifier type: GIFT, INSIGHT, CHECK, CHAT, BELL' })
  @IsOptional()
  @IsString()
  iconType?: string;

  @ApiPropertyOptional({ description: 'Avatar image URL if applicable' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({ description: 'Action button or link label' })
  @IsOptional()
  @IsString()
  actionText?: string;

  @ApiPropertyOptional({ description: 'Deeplink or route path' })
  @IsOptional()
  @IsString()
  actionUrl?: string;
}
