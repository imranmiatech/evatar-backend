import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { RECIPE_MEAL_TYPES } from '../constants/kitchan.constants';

export class AddRecipeToScheduleDto {
  @ApiProperty({ example: 'seed-child-eve' })
  @IsString()
  childId!: string;

  @ApiProperty({ example: '2026-07-19' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ enum: RECIPE_MEAL_TYPES })
  @IsIn(RECIPE_MEAL_TYPES)
  @IsOptional()
  mealType?: string;

  @ApiPropertyOptional({ example: '2026-07-19T08:00:00.000Z' })
  @IsDateString()
  @IsOptional()
  startTime?: string;

  @ApiPropertyOptional({ example: '2026-07-19T08:30:00.000Z' })
  @IsDateString()
  @IsOptional()
  endTime?: string;

  @ApiPropertyOptional({ example: 'Serve warm and soft.' })
  @IsString()
  @IsOptional()
  notes?: string;
}

