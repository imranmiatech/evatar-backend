import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ProfileNannyPortfolioQueryDto {
  @ApiPropertyOptional({
    enum: ['overview', 'week', 'month'],
    default: 'overview',
  })
  @IsIn(['overview', 'week', 'month'])
  @IsOptional()
  period?: 'overview' | 'week' | 'month' = 'overview';

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
