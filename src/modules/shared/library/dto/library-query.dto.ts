import { ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityType, RecipeMealType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class LibraryQueryDto {
  @ApiPropertyOptional({ description: 'Search by title (activity or recipe)', example: 'Color Hunt' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: ActivityType, description: 'Filter by activity type' })
  @IsEnum(ActivityType)
  @IsOptional()
  activityType?: ActivityType;

  @ApiPropertyOptional({ enum: RecipeMealType, description: 'Filter by recipe meal type' })
  @IsEnum(RecipeMealType)
  @IsOptional()
  recipeMealType?: RecipeMealType;

  @ApiPropertyOptional({ description: 'Page number (default: 1)', example: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page (default: 20)', example: 20 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 20;
}
