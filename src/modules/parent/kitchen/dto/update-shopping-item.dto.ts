import { PartialType } from '@nestjs/swagger';
import { CreateShoppingItemDto } from './create-shopping-item.dto';

export class UpdateShoppingItemDto extends PartialType(CreateShoppingItemDto) {}
