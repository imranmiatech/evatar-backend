import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ManualActivityDto {
  @ApiProperty({ example: 'BREAKFAST' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ example: 'Blueberry oat porridge' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'Serve warm with banana slices.' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: '2026-07-19T08:00:00.000Z' })
  @IsDateString()
  @IsOptional()
  startTime?: string;

  @ApiPropertyOptional({ example: '2026-07-19T08:30:00.000Z' })
  @IsDateString()
  @IsOptional()
  endTime?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @IsOptional()
  sortOrder?: number;
}

export class CreateManualDayPlanDto {
  @ApiProperty({ example: '2026-07-19' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ example: 'Eve day plan' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ type: [ManualActivityDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualActivityDto)
  @IsOptional()
  activities?: ManualActivityDto[];
}

export class AddActivityDto extends ManualActivityDto {}
