import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUserPayload } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import {
  AddRecipeToScheduleDto,
  CreateInventoryItemDto,
  CreatePaymentMethodDto,
  CreateShoppingListItemDto,
  CreateVoucherDto,
  UpdateInventoryItemDto,
  UpdateShoppingListItemDto,
} from './dto';
import { KitchanService } from './kitchan.service';

@ApiTags('Kitchen')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('kitchen')
export class KitchanController {
  constructor(private readonly kitchanService: KitchanService) {}

  @Get('recipes')
  @ApiOperation({ summary: 'List recipes for parent/nanny kitchen' })
  listRecipes(
    @Query('mealType') mealType?: string,
    @Query('category') category?: string,
  ) {
    return this.kitchanService.listRecipes(mealType, category);
  }

  @Get('recipes/:recipeId')
  @ApiOperation({ summary: 'Get recipe details' })
  getRecipe(@Param('recipeId') recipeId: string) {
    return this.kitchanService.getRecipe(recipeId);
  }

  @Get('recipes/:recipeId/missing-ingredients')
  @ApiOperation({ summary: 'Check recipe missing ingredients for a child' })
  getMissingIngredients(
    @CurrentUser() user: CurrentUserPayload,
    @Param('recipeId') recipeId: string,
    @Query('childId') childId: string,
  ) {
    return this.kitchanService.getMissingIngredients(user, recipeId, childId);
  }

  @Post('recipes/:recipeId/add-missing-to-shopping-list')
  @ApiOperation({ summary: 'Add missing recipe ingredients to shopping list' })
  addMissingToShoppingList(
    @CurrentUser() user: CurrentUserPayload,
    @Param('recipeId') recipeId: string,
    @Body('childId') childId: string,
  ) {
    return this.kitchanService.addRecipeMissingToShoppingList(
      user,
      recipeId,
      childId,
    );
  }

  @Post('recipes/:recipeId/add-to-schedule')
  @ApiOperation({ summary: 'Add recipe to child meal schedule and Today timeline' })
  addRecipeToSchedule(
    @CurrentUser() user: CurrentUserPayload,
    @Param('recipeId') recipeId: string,
    @Body() dto: AddRecipeToScheduleDto,
  ) {
    return this.kitchanService.addRecipeToSchedule(user, recipeId, dto);
  }

  @Get('inventory')
  @ApiOperation({ summary: 'List kitchen inventory by child/status' })
  listInventory(
    @CurrentUser() user: CurrentUserPayload,
    @Query('childId') childId: string,
    @Query('status') status?: string,
  ) {
    return this.kitchanService.listInventory(user, childId, status);
  }

  @Post('inventory')
  @ApiOperation({ summary: 'Create inventory item' })
  createInventory(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateInventoryItemDto,
  ) {
    return this.kitchanService.createInventory(user, dto);
  }

  @Patch('inventory/:itemId')
  @ApiOperation({ summary: 'Update inventory item' })
  updateInventory(
    @CurrentUser() user: CurrentUserPayload,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateInventoryItemDto,
  ) {
    return this.kitchanService.updateInventory(user, itemId, dto);
  }

  @Delete('inventory/:itemId')
  @ApiOperation({ summary: 'Delete inventory item' })
  deleteInventory(
    @CurrentUser() user: CurrentUserPayload,
    @Param('itemId') itemId: string,
  ) {
    return this.kitchanService.deleteInventory(user, itemId);
  }

  @Get('shopping-list')
  @ApiOperation({ summary: 'Get or create active shopping list for child' })
  getShoppingList(
    @CurrentUser() user: CurrentUserPayload,
    @Query('childId') childId: string,
  ) {
    return this.kitchanService.getShoppingList(user, childId);
  }

  @Post('shopping-list/items')
  @ApiOperation({ summary: 'Add shopping list item' })
  addShoppingListItem(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateShoppingListItemDto,
  ) {
    return this.kitchanService.addShoppingListItem(user, dto);
  }

  @Patch('shopping-list/items/:itemId')
  @ApiOperation({ summary: 'Update shopping list item' })
  updateShoppingListItem(
    @CurrentUser() user: CurrentUserPayload,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateShoppingListItemDto,
  ) {
    return this.kitchanService.updateShoppingListItem(user, itemId, dto);
  }

  @Delete('shopping-list/items/:itemId')
  @ApiOperation({ summary: 'Delete shopping list item' })
  deleteShoppingListItem(
    @CurrentUser() user: CurrentUserPayload,
    @Param('itemId') itemId: string,
  ) {
    return this.kitchanService.deleteShoppingListItem(user, itemId);
  }

  @Get('stores')
  @ApiOperation({ summary: 'List grocery stores/vendors' })
  listStores() {
    return this.kitchanService.listStores();
  }

  @Post('shopping-vouchers')
  @ApiOperation({ summary: 'Create shopping voucher from shopping list' })
  createVoucher(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateVoucherDto,
  ) {
    return this.kitchanService.createVoucher(user, dto);
  }

  @Get('shopping-vouchers/:voucherId')
  @ApiOperation({ summary: 'Get shopping voucher details' })
  getVoucher(
    @CurrentUser() user: CurrentUserPayload,
    @Param('voucherId') voucherId: string,
  ) {
    return this.kitchanService.getVoucher(user, voucherId);
  }

  @Post('shopping-vouchers/:voucherId/send-to-parent')
  @ApiOperation({ summary: 'Mark voucher sent to parent' })
  sendVoucherToParent(
    @CurrentUser() user: CurrentUserPayload,
    @Param('voucherId') voucherId: string,
  ) {
    return this.kitchanService.updateVoucherStatus(
      user,
      voucherId,
      'SENT_TO_PARENT',
    );
  }

  @Post('shopping-vouchers/:voucherId/send-to-store')
  @ApiOperation({ summary: 'Mark voucher sent to store/vendor' })
  sendVoucherToStore(
    @CurrentUser() user: CurrentUserPayload,
    @Param('voucherId') voucherId: string,
  ) {
    return this.kitchanService.updateVoucherStatus(
      user,
      voucherId,
      'SENT_TO_STORE',
    );
  }

  @Post('shopping-vouchers/:voucherId/send-reminder')
  @ApiOperation({ summary: 'Send reminder marker for voucher' })
  sendReminder(
    @CurrentUser() user: CurrentUserPayload,
    @Param('voucherId') voucherId: string,
  ) {
    return this.kitchanService.updateVoucherStatus(
      user,
      voucherId,
      'SENT_TO_PARENT',
    );
  }

  @Post('shopping-vouchers/:voucherId/create-order')
  @ApiOperation({ summary: 'Create grocery order from voucher' })
  createOrderFromVoucher(
    @CurrentUser() user: CurrentUserPayload,
    @Param('voucherId') voucherId: string,
  ) {
    return this.kitchanService.createOrderFromVoucher(user, voucherId);
  }

  @Get('orders')
  @ApiOperation({ summary: 'List grocery orders' })
  listOrders(
    @CurrentUser() user: CurrentUserPayload,
    @Query('childId') childId?: string,
  ) {
    return this.kitchanService.listOrders(user, childId);
  }

  @Get('orders/:orderId')
  @ApiOperation({ summary: 'Get grocery order details' })
  getOrder(
    @CurrentUser() user: CurrentUserPayload,
    @Param('orderId') orderId: string,
  ) {
    return this.kitchanService.getOrder(user, orderId);
  }

  @Post('orders/:orderId/cancel')
  @ApiOperation({ summary: 'Cancel grocery order' })
  cancelOrder(
    @CurrentUser() user: CurrentUserPayload,
    @Param('orderId') orderId: string,
  ) {
    return this.kitchanService.cancelOrder(user, orderId);
  }

  @Post('orders/:orderId/confirm-payment')
  @ApiOperation({ summary: 'Parent confirms payment for order' })
  confirmPayment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('orderId') orderId: string,
    @Body('paymentMethodId') paymentMethodId?: string,
  ) {
    return this.kitchanService.confirmPayment(user, orderId, paymentMethodId);
  }

  @Post('orders/:orderId/stripe-checkout-session')
  @ApiOperation({ summary: 'Parent creates Stripe checkout session for order' })
  createStripeCheckoutSession(
    @CurrentUser() user: CurrentUserPayload,
    @Param('orderId') orderId: string,
  ) {
    return this.kitchanService.createStripeCheckoutSession(user, orderId);
  }

  @Post('orders/:orderId/confirm-received')
  @ApiOperation({ summary: 'Parent or nanny confirms received delivery' })
  confirmReceived(
    @CurrentUser() user: CurrentUserPayload,
    @Param('orderId') orderId: string,
  ) {
    return this.kitchanService.confirmReceived(user, orderId);
  }

  @Get('payment-methods')
  @ApiOperation({ summary: 'Parent lists payment methods' })
  listPaymentMethods(@CurrentUser() user: CurrentUserPayload) {
    return this.kitchanService.listPaymentMethods(user);
  }

  @Post('payment-methods')
  @ApiOperation({ summary: 'Parent creates payment method' })
  createPaymentMethod(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreatePaymentMethodDto,
  ) {
    return this.kitchanService.createPaymentMethod(user, dto);
  }

  @Delete('payment-methods/:paymentMethodId')
  @ApiOperation({ summary: 'Parent archives payment method' })
  deletePaymentMethod(
    @CurrentUser() user: CurrentUserPayload,
    @Param('paymentMethodId') paymentMethodId: string,
  ) {
    return this.kitchanService.deletePaymentMethod(user, paymentMethodId);
  }
}
