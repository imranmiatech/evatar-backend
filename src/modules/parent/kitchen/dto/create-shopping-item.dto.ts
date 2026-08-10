import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { KitchenItemCategory, ItemUnit } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateShoppingItemDto {
  @ApiPropertyOptional({
    description: 'Target parent user ID. Admin/nanny only; parent requests ignore this value.',
    example: '74424fe6-492c-481f-92ab-6d2b10d1dfd8',
  })
  @IsString()
  @IsOptional()
  userId?: string;

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

  @ApiPropertyOptional({
    description: 'Whether this item was entered as a custom order.',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isCustomOrder?: boolean;

  @ApiPropertyOptional({
    description: 'When checked, also add this shopping/custom order item to kitchen inventory.',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  addToKitchen?: boolean;
}
