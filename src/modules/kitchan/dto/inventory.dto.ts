import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import {
  KITCHEN_INVENTORY_STATUSES,
  KITCHEN_ITEM_CATEGORIES,
} from '../constants/kitchan.constants';

export class CreateInventoryItemDto {
  @ApiProperty({ example: 'seed-child-eve' })
  @IsString()
  childId!: string;

  @ApiProperty({ example: 'Organic Whole Milk' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'Liter' })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({ enum: KITCHEN_ITEM_CATEGORIES })
  @IsIn(KITCHEN_ITEM_CATEGORIES)
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ enum: KITCHEN_INVENTORY_STATUSES })
  @IsIn(KITCHEN_INVENTORY_STATUSES)
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: 25 })
  @IsInt()
  @IsOptional()
  currentStockPercent?: number;

  @ApiPropertyOptional({ example: 25 })
  @IsInt()
  @IsOptional()
  thresholdPercent?: number;

  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @ApiPropertyOptional({ example: 'Used 2 for breakfast this morning.' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateInventoryItemDto {
  @ApiPropertyOptional({ example: 'Organic Whole Milk' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'Liter' })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({ enum: KITCHEN_ITEM_CATEGORIES })
  @IsIn(KITCHEN_ITEM_CATEGORIES)
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ enum: KITCHEN_INVENTORY_STATUSES })
  @IsIn(KITCHEN_INVENTORY_STATUSES)
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: 25 })
  @IsInt()
  @IsOptional()
  currentStockPercent?: number;

  @ApiPropertyOptional({ example: 25 })
  @IsInt()
  @IsOptional()
  thresholdPercent?: number;

  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @ApiPropertyOptional({ example: 'Used 2 for breakfast this morning.' })
  @IsString()
  @IsOptional()
  notes?: string;
}

