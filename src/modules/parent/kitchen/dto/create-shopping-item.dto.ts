import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { KitchenItemCategory, ItemUnit } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateShoppingItemDto {
  @ApiProperty({ description: 'Item name', example: 'Organic Whole Milk' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    enum: ItemUnit,
    description: 'Unit of measurement',
    example: ItemUnit.LITER,
  })
  @IsEnum(ItemUnit)
  @IsNotEmpty()
  unit: ItemUnit;

  @ApiProperty({ description: 'Quantity to buy', example: '2' })
  @IsString()
  @IsNotEmpty()
  quantity: string;

  @ApiProperty({
    enum: KitchenItemCategory,
    description: 'Item category',
    example: KitchenItemCategory.DAIRY,
  })
  @IsEnum(KitchenItemCategory)
  @IsNotEmpty()
  category: KitchenItemCategory;

  @ApiPropertyOptional({ description: 'Optional note', example: 'Full fat only' })
  @IsString()
  @IsOptional()
  note?: string;
}
