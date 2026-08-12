import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';

const normalizeRange = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  return value.trim().toUpperCase();
};

export class PartnerDashboardRangeQueryDto {
  @ApiPropertyOptional({ enum: ['7D', '30D', '3M'], example: '7D' })
  @IsOptional()
  @Transform(normalizeRange)
  @IsIn(['7D', '30D', '3M'])
  range?: '7D' | '30D' | '3M' = '7D';
}
