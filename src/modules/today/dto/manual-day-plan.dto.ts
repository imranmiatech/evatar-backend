import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsObject,
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

  @ApiPropertyOptional({
    example:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
  })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({
    example: {
      developmentalBenefits: [
        {
          title: 'Gross motor development',
          body: 'Supports balance, reaching, and movement control.',
        },
      ],
      howToDoIt: [
        'Pick a color together.',
        'Search safely within sight.',
        'Name each discovery.',
      ],
      caregiverPrompts: ['What color did you find?', 'Where else can we see it?'],
      progressionLevels: [
        {
          level: 'Level 1',
          body: 'Name basic colors and point to matching objects.',
        },
      ],
      safetyNotes: ['Stay within sight', 'Avoid sharp objects'],
    },
  })
  @IsObject()
  @IsOptional()
  detail?: Record<string, unknown>;

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
