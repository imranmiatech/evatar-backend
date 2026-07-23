import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

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
