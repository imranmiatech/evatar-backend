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

export class CreateLibraryScheduleDto {
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
    description: 'ID of the Activity or Recipe from the library',
    example: 'uuid-here',
  })
  @IsString()
  @IsNotEmpty()
  libraryItemId: string;

  @ApiProperty({
    enum: ['activity', 'recipe'],
    description: 'Type of the library item',
    example: 'activity',
  })
  @IsEnum(['activity', 'recipe'])
  @IsNotEmpty()
  libraryItemType: 'activity' | 'recipe';

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
