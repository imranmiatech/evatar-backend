import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { ShoppingListItemStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateShoppingItemDto } from './create-shopping-item.dto';

export class UpdateShoppingItemDto extends PartialType(CreateShoppingItemDto) {
  @ApiPropertyOptional({
    enum: ShoppingListItemStatus,
    description: 'Update shopping item status, e.g. add item to voucher.',
    example: ShoppingListItemStatus.ADDED_TO_VOUCHER,
  })
  @IsEnum(ShoppingListItemStatus)
  @IsOptional()
  status?: ShoppingListItemStatus;
}
