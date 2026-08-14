import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityLocation, ActivityType, RecipeMealType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LibraryQueryDto {
  @ApiPropertyOptional({
    description: 'Search by title (activity or recipe)',
    example: 'Color Hunt',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    enum: RecipeMealType,
    description:
      'Filter recipes by meal type (Breakfast, Lunch, Dinner, Snack, Family)',
    example: RecipeMealType.BREAKFAST,
  })
  @IsEnum(RecipeMealType)
  @IsOptional()
  recipeMealType?: RecipeMealType;

  @ApiPropertyOptional({
    enum: ActivityType,
    description: 'Filter activities by type',
    example: ActivityType.OUTDOOR_PLAY,
  })
  @IsEnum(ActivityType)
  @IsOptional()
  activityType?: ActivityType;

  @ApiPropertyOptional({
    enum: ActivityLocation,
    description: 'Filter activities by location (Indoor, Outdoor)',
    example: ActivityLocation.INDOOR,
  })
  @IsEnum(ActivityLocation)
  @IsOptional()
  location?: ActivityLocation;

  @ApiPropertyOptional({
    description:
      'Filter by UI age group. Endpoint-specific dropdowns are shown on activities and recipes APIs.',
    example: '0-6 month',
  })
  @IsString()
  @IsOptional()
  declare ageGroup?: string;

  @ApiPropertyOptional({
    description: 'Filter activities by minimum age in months',
    example: 0,
  })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  minAge?: number;

  @ApiPropertyOptional({
    description: 'Filter activities by maximum age in months',
    example: 12,
  })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  maxAge?: number;

  @ApiPropertyOptional({ description: 'Page number (default: 1)', example: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page (default: 20)',
    example: 20,
  })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 20;
}

export class ActivityLibraryQueryDto extends LibraryQueryDto {
  @ApiPropertyOptional({
    description: 'Filter activities by UI age group.',
    enum: ['0-6 month', '6-12 month', '12-24 month', '2-4 year', '4 year +'],
    example: '0-6 month',
  })
  @IsString()
  @IsOptional()
  declare ageGroup?: string;
}

export class RecipeLibraryQueryDto extends LibraryQueryDto {
  @ApiPropertyOptional({
    description: 'Filter recipes by UI age group.',
    enum: ['0-6 month', '6-9 month', '12-24 month', '2 year +'],
    example: '0-6 month',
  })
  @IsString()
  @IsOptional()
  declare ageGroup?: string;
}

export class ActivitySuggestionQueryDto {
  @ApiProperty({
    description: 'Child ID used to suggest age-appropriate activities',
    example: 'clxxx...',
  })
  @IsString()
  @IsNotEmpty()
  childId: string;
}
