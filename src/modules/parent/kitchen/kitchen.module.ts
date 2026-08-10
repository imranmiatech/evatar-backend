import { Module } from '@nestjs/common';
import { KitchenItemController } from './controllers/kitchen-item.controller';
import { ShoppingListController } from './controllers/shopping-list.controller';
import { KitchenSuggestionController } from './controllers/kitchen-suggestion.controller';
import { KitchenItemService } from './services/kitchen-item.service';
import { ShoppingListService } from './services/shopping-list.service';
import { KitchenSuggestionService } from './services/kitchen-suggestion.service';
import { KitchenAccessService } from './services/kitchen-access.service';

@Module({
  controllers: [
    KitchenItemController,
    ShoppingListController,
    KitchenSuggestionController,
  ],
  providers: [
    KitchenAccessService,
    KitchenItemService,
    ShoppingListService,
    KitchenSuggestionService,
  ],
})
export class KitchenModule {}
