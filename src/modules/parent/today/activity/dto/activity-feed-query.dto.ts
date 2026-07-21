import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class ActivityFeedQueryDto {
  @ApiPropertyOptional({
    example: '2026-07-20',
    description: 'Day to load. Defaults to today when omitted.',
  })
  @IsDateString()
  @IsOptional()
  date?: string;
}
