import { ApiPropertyOptional } from '@nestjs/swagger';
import { ScheduleCategory } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateScheduleDto {
  @ApiPropertyOptional({
    description: 'Task title',
    example: 'Morning Walk',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    enum: ScheduleCategory,
    description: 'Activity category',
    example: ScheduleCategory.ACTIVITY,
  })
  @IsEnum(ScheduleCategory)
  @IsOptional()
  category?: ScheduleCategory;

  @ApiPropertyOptional({
    description: 'Schedule date (ISO 8601).',
    example: '2024-11-16',
  })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({ description: 'Start time (HH:mm)', example: '09:15' })
  @IsString()
  @IsOptional()
  startTime?: string;

  @ApiPropertyOptional({ description: 'End time (HH:mm)', example: '10:00' })
  @IsString()
  @IsOptional()
  endTime?: string;

  @ApiPropertyOptional({
    description: 'Description & notes (max 20 words)',
    example: 'Head to the park for some fresh air and play time...',
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'ID of the Activity or Recipe from the library (if changing the library item)',
    example: 'uuid-here',
  })
  @IsString()
  @IsOptional()
  libraryItemId?: string;

  @ApiPropertyOptional({
    enum: ['activity', 'recipe'],
    description: 'Type of the library item',
    example: 'activity',
  })
  @IsEnum(['activity', 'recipe'])
  @IsOptional()
  libraryItemType?: 'activity' | 'recipe';
}
