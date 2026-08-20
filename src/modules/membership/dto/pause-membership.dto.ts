import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

export class PauseMembershipDto {
  @ApiPropertyOptional({
    example: 2,
    description: 'Pause duration in weeks (e.g. 2 or 4)',
  })
  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  durationWeeks?: number;

  @ApiPropertyOptional({
    example: '2026-10-31',
    description: 'Custom resume date string (ISO format)',
  })
  @IsDateString()
  @IsOptional()
  customResumeDate?: string;
}
