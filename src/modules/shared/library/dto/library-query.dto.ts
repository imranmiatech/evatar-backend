import { ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityLocation, ActivityType, RecipeMealType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
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
    description: 'Filter recipes by meal type (Breakfast, Lunch, Dinner, Snack, Family)',
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
    description: 'Filter by minimum age in months (e.g. 0 for "Age: 0-12 months")',
    example: 0,
  })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  minAge?: number;

  @ApiPropertyOptional({
    description: 'Filter by maximum age in months (e.g. 12 for "Age: 0-12 months")',
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

  @ApiPropertyOptional({ description: 'Items per page (default: 20)', example: 20 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 20;
}
