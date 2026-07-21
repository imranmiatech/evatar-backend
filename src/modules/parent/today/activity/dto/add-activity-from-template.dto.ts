import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional } from 'class-validator';

export class AddActivityFromTemplateDto {
  @ApiPropertyOptional({ example: '2026-07-20T10:00:00.000Z' })
  @IsDateString()
  @IsOptional()
  startTime?: string;

  @ApiPropertyOptional({ example: '2026-07-20T10:45:00.000Z' })
  @IsDateString()
  @IsOptional()
  endTime?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsInt()
  @IsOptional()
  sortOrder?: number;
}
