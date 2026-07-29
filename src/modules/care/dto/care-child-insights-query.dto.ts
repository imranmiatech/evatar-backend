import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min, Max } from 'class-validator';

export class CareChildInsightsQueryDto {
  @ApiPropertyOptional({ enum: ['week', 'month'], default: 'month' })
  @IsIn(['week', 'month'])
  @IsOptional()
  period?: 'week' | 'month' = 'month';

  @ApiPropertyOptional({ description: 'Month number, 1-12', example: 10 })
  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  @IsOptional()
  month?: number;

  @ApiPropertyOptional({
    description: 'Week number inside selected month, 1-5',
    example: 2,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  @IsOptional()
  week?: number;
}
