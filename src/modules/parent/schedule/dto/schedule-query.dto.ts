import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ScheduleView {
  ALL = 'ALL',
  TODAY = 'TODAY',
  DATE = 'DATE',
  UPCOMING = 'UPCOMING',
}

export class ScheduleQueryDto {
  @ApiPropertyOptional({
    description: 'Child ID to filter schedules',
    example: 'clxxx...',
  })
  @IsString()
  @IsOptional()
  childId?: string;

  @ApiPropertyOptional({
    description: 'Filter by date (ISO 8601). Defaults to today.',
    example: '2024-11-16',
  })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({
    enum: ScheduleView,
    description:
      'ALL returns today, selected date, and upcoming. TODAY returns only today. DATE requires/uses date. UPCOMING returns schedules after today.',
    example: ScheduleView.ALL,
    default: ScheduleView.ALL,
  })
  @IsEnum(ScheduleView)
  @IsOptional()
  view?: ScheduleView = ScheduleView.ALL;

  @ApiPropertyOptional({ description: 'Page number', example: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', example: 20 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 20;
}
