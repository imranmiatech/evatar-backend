import { Module } from '@nestjs/common';
import { PaymentModule } from '../../payment/payment.module';
import { GroceryOrderController } from './controllers/grocery-order.controller';
import { KitchenItemController } from './controllers/kitchen-item.controller';
import { ShoppingListController } from './controllers/shopping-list.controller';
import { KitchenSuggestionController } from './controllers/kitchen-suggestion.controller';
import { PartnerGroceryOrderController } from './controllers/partner-grocery-order.controller';
import { GroceryOrderService } from './services/grocery-order.service';
import { KitchenItemService } from './services/kitchen-item.service';
import { ShoppingListService } from './services/shopping-list.service';
import { KitchenSuggestionService } from './services/kitchen-suggestion.service';
import { KitchenAccessService } from './services/kitchen-access.service';

@Module({
  imports: [PaymentModule],
  controllers: [
    KitchenItemController,
    ShoppingListController,
    KitchenSuggestionController,
    GroceryOrderController,
    PartnerGroceryOrderController,
  ],
  providers: [
    KitchenAccessService,
    KitchenItemService,
    ShoppingListService,
    KitchenSuggestionService,
    GroceryOrderService,
  ],
})
export class KitchenModule {}
