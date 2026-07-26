import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class NannyFeedbackQueryDto {
  @ApiPropertyOptional({
    description: 'Filter feedback by child ID.',
  })
  @IsOptional()
  @IsString()
  childId?: string;

  @ApiPropertyOptional({
    description: 'Filter feedback by date. Defaults to today when omitted.',
    example: '2026-07-26',
  })
  @IsOptional()
  @IsDateString()
  date?: string;
}
