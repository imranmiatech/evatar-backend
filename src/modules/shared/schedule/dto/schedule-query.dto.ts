import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

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
}
