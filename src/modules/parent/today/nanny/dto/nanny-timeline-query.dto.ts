import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class NannyTimelineQueryDto {
  @ApiPropertyOptional({
    example: 'seed-child-eve',
    description:
      'Assigned child to load. Defaults to the first assigned child.',
  })
  @IsString()
  @IsOptional()
  childId?: string;

  @ApiPropertyOptional({
    example: '2026-07-20',
    description: 'Timeline date. Defaults to today.',
  })
  @IsDateString()
  @IsOptional()
  date?: string;
}
