import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ChildDailyTimelineQueryDto {
  @ApiPropertyOptional({
    description: 'Schedule date (ISO 8601). Defaults to today if not provided.',
    example: '2024-11-16',
  })
  @IsDateString()
  @IsOptional()
  date?: string;
}
