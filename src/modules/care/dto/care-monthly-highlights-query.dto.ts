import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CareMonthlyHighlightsQueryDto {
  @ApiPropertyOptional({ description: 'Month number, 1-12', example: 6 })
  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  @IsOptional()
  month?: number;
}
