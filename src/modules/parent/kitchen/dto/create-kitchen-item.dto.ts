import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { KitchenItemCategory, ItemUnit } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateKitchenItemDto {
  @ApiProperty({ description: 'Item name', example: 'Organic Whole Milk' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    enum: ItemUnit,
    description: 'Unit of measurement',
    example: ItemUnit.LITER,
  })
  @IsEnum(ItemUnit)
  @IsOptional()
  unit?: ItemUnit;

  @ApiProperty({
    enum: KitchenItemCategory,
    description: 'Item category',
    example: KitchenItemCategory.DAIRY,
  })
  @IsEnum(KitchenItemCategory)
  @IsNotEmpty()
  category: KitchenItemCategory;

  @ApiPropertyOptional({
    description: 'Current stock percentage (0–100). Defaults to 100.',
    example: 10,
    minimum: 0,
    maximum: 100,
  })
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  currentStockPercent?: number;

  @ApiPropertyOptional({ description: 'Optional note', example: 'Used 2 for breakfast this morning' })
  @IsString()
  @IsOptional()
  notes?: string;
}
