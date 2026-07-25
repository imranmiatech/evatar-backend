import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScheduleCategory } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateManualScheduleDto {
  @ApiProperty({ description: 'Child ID', example: 'clxxx...' })
  @IsString()
  @IsNotEmpty()
  childId: string;

  @ApiPropertyOptional({
    description:
      'Schedule date (ISO 8601). Defaults to today if not provided.',
    example: '2024-11-16',
  })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiProperty({
    description: 'Task title',
    example: 'Morning Walk',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    enum: ScheduleCategory,
    description: 'Activity category',
    example: ScheduleCategory.ACTIVITY,
  })
  @IsEnum(ScheduleCategory)
  @IsNotEmpty()
  category: ScheduleCategory;

  @ApiProperty({ description: 'Start time (HH:mm)', example: '09:15' })
  @IsString()
  @IsNotEmpty()
  startTime: string;

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
}
