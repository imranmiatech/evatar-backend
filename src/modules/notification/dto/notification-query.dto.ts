import { IsOptional, IsInt, Min, IsBoolean, IsEnum } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum NotificationGroupFilter {
  ALL = 'ALL',
  TODAY = 'TODAY',
  THIS_WEEK = 'THIS_WEEK',
  OLDER = 'OLDER',
}

export class NotificationQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter unread notifications only' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isRead?: boolean;

  @ApiPropertyOptional({ enum: NotificationGroupFilter, default: NotificationGroupFilter.ALL })
  @IsOptional()
  @IsEnum(NotificationGroupFilter)
  group?: NotificationGroupFilter = NotificationGroupFilter.ALL;
}
