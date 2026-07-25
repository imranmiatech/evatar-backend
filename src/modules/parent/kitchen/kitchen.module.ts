import { Module } from '@nestjs/common';
import { KitchenItemController } from './controllers/kitchen-item.controller';
import { ShoppingListController } from './controllers/shopping-list.controller';
import { KitchenItemService } from './services/kitchen-item.service';
import { ShoppingListService } from './services/shopping-list.service';

@Module({
  controllers: [KitchenItemController, ShoppingListController],
  providers: [KitchenItemService, ShoppingListService],
})
export class KitchenModule {}
