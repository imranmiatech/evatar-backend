import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import {
  KITCHEN_ITEM_CATEGORIES,
  SHOPPING_LIST_ITEM_STATUSES,
} from '../constants/kitchan.constants';

export class CreateShoppingListItemDto {
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

  @ApiPropertyOptional({ enum: SHOPPING_LIST_ITEM_STATUSES })
  @IsIn(SHOPPING_LIST_ITEM_STATUSES)
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: 'Prefer organic if available.' })
  @IsString()
  @IsOptional()
  note?: string;
}

export class UpdateShoppingListItemDto {
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

  @ApiPropertyOptional({ enum: SHOPPING_LIST_ITEM_STATUSES })
  @IsIn(SHOPPING_LIST_ITEM_STATUSES)
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: 'Prefer organic if available.' })
  @IsString()
  @IsOptional()
  note?: string;
}

