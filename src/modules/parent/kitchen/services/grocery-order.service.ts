import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GroceryOrderStatus,
  KitchenItemCategory,
  PaymentMethodType,
  ShoppingListItemStatus,
  UserRole,
} from '@prisma/client';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { PaymentAccountService } from '../../../payment/payment-account.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  CreateGroceryOrderDto,
  GroceryCheckoutPreviewDto,
  GroceryOrderAction,
  UpdateGroceryOrderDto,
} from '../dto/grocery-order.dto';
import { KitchenAccessService } from './kitchen-access.service';
import {
  formatGroceryOrder,
  formatStore,
  groceryOrderInclude,
} from '../utils/grocery-order-response.util';

@Injectable()
export class GroceryOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kitchenAccess: KitchenAccessService,
    private readonly paymentAccountService: PaymentAccountService,
  ) {}

  async getAvailableStores(user: CurrentUserPayload, targetUserId?: string) {
    const ownerUserId = await this.kitchenAccess.resolveWritableParentUserId(
      user,
      targetUserId,
      'groceryOrdering',
    );

    const stores = await this.prisma.store.findMany({
      where: {
        user: { role: UserRole.PARTNER },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
      orderBy: [{ name: 'asc' }],
    });

    return {
      success: true,
      message: 'Partner stores fetched successfully',
      data: {
        ownerUserId,
        stores: stores.map((store) => formatStore(store)),
      },
    };
  }

  async previewCheckout(
    user: CurrentUserPayload,
    dto: GroceryCheckoutPreviewDto,
  ) {
    const ownerUserId = await this.kitchenAccess.resolveWritableParentUserId(
      user,
      dto.userId,
      'groceryOrdering',
    );
    const shoppingItems = await this.getSelectableShoppingItems(
      ownerUserId,
      dto.itemIds,
    );

    if (!shoppingItems.length) {
      throw new BadRequestException('No shopping items available for checkout');
    }

    const stores = await this.prisma.store.findMany({
      where: { user: { role: UserRole.PARTNER } },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
      orderBy: [{ name: 'asc' }],
    });

    const selectedStore =
      (dto.storeId
        ? stores.find((store) => store.id === dto.storeId)
        : stores[0]) ?? null;

    if (dto.storeId && !selectedStore) {
      throw new NotFoundException('Selected partner store not found');
    }

    const pricedItems = shoppingItems.map((item) =>
      this.buildQuotedItem(item, selectedStore?.name),
    );
    const pricing = this.calculatePricing(pricedItems);
    const paymentMethods = await this.paymentAccountService.getPaymentMethods(
      user.userId,
    );

    return {
      success: true,
      message: 'Shopping voucher preview generated successfully',
      data: {
        ownerUserId,
        voucherDate: new Date(),
        itemCount: pricedItems.length,
        voucherItems: pricedItems,
        finalNote: '',
        selectedStore: selectedStore ? formatStore(selectedStore) : null,
        storeOptions: stores.map((store) => formatStore(store)),
        paymentMethods,
        pricing,
      },
    };
  }

  async createOrder(user: CurrentUserPayload, dto: CreateGroceryOrderDto) {
    const ownerUserId = await this.kitchenAccess.resolveWritableParentUserId(
      user,
      dto.userId,
      'groceryOrdering',
    );
    const shoppingItems = await this.getSelectableShoppingItems(
      ownerUserId,
      dto.itemIds,
    );

    if (!shoppingItems.length) {
      throw new BadRequestException('No shopping items available for ordering');
    }

    const store = await this.prisma.store.findUnique({
      where: { id: dto.storeId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
    });

    if (!store) {
      throw new NotFoundException('Selected partner store not found');
    }

    const pricedItems = shoppingItems.map((item) =>
      this.buildQuotedItem(item, store.name),
    );
    const pricing = this.calculatePricing(pricedItems);
    const orderCode = this.generateOrderCode();
    const trackingCode = this.generateTrackingCode();

    const order = await this.prisma.$transaction(async (tx) => {
      const createdOrder = await tx.groceryOrder.create({
        data: {
          userId: ownerUserId,
          storeId: store.id,
          orderId: orderCode,
          trackingCode,
          status: GroceryOrderStatus.VOUCHER_SENT,
          finalNote: dto.finalNote?.trim() || null,
          deliveryAddress: dto.deliveryAddress.trim(),
          receiverPhone: dto.receiverPhone.trim(),
          estimatedDeliveryAt: this.estimateDeliveryTime(),
          subtotal: pricing.subtotal,
          onlineDiscount: pricing.onlineDiscount,
          deliveryFee: pricing.deliveryFee,
          total: pricing.total,
          paymentType: dto.paymentType,
          items: {
            create: pricedItems.map((item) => ({
              name: item.name,
              unit: item.unit,
              quantity: item.quantity,
              category: item.category,
              note: item.note,
              price: item.price,
            })),
          },
        },
        include: groceryOrderInclude(),
      });

      await tx.shoppingListItem.updateMany({
        where: { id: { in: shoppingItems.map((item) => item.id) } },
        data: {
          status: ShoppingListItemStatus.ORDERED,
        },
      });

      return createdOrder;
    });

    let nextStatus =
      dto.paymentType === PaymentMethodType.CASH_ON_DELIVERY
        ? GroceryOrderStatus.ORDER_CONFIRMED
        : GroceryOrderStatus.STORE_REVIEWED;

    if (dto.paymentType !== PaymentMethodType.ONLINE) {
      await this.prisma.groceryOrder.update({
        where: { id: order.id },
        data: { status: nextStatus },
      });
    }

    const freshOrder = await this.prisma.groceryOrder.findUnique({
      where: { id: order.id },
      include: groceryOrderInclude(),
    });

    return {
      success: true,
      message: 'Grocery order created successfully',
      data: formatGroceryOrder(freshOrder!),
    };
  }

  async listOrders(user: CurrentUserPayload) {
    const readableParentIds =
      await this.kitchenAccess.resolveReadableParentUserIds(
        user,
        'manageGroceryOrders',
      );

    const orders = await this.prisma.groceryOrder.findMany({
      where: readableParentIds ? { userId: { in: readableParentIds } } : {},
      include: groceryOrderInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      message: 'Grocery orders fetched successfully',
      data: orders.map((order) => formatGroceryOrder(order)),
    };
  }

  async getOrderById(user: CurrentUserPayload, orderId: string) {
    const order = await this.prisma.groceryOrder.findUnique({
      where: { id: orderId },
      include: groceryOrderInclude(),
    });

    if (!order) {
      throw new NotFoundException('Grocery order not found');
    }

    if (
      !(await this.kitchenAccess.canAccessParentUser(
        user,
        order.userId,
        'manageGroceryOrders',
      ))
    ) {
      throw new ForbiddenException('You do not have access to this order');
    }

    return {
      success: true,
      message: 'Grocery order fetched successfully',
      data: formatGroceryOrder(order),
    };
  }

  async updateOrder(
    user: CurrentUserPayload,
    orderId: string,
    dto: UpdateGroceryOrderDto,
  ) {
    const order = await this.prisma.groceryOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Grocery order not found');
    }

    if (
      !(await this.kitchenAccess.canAccessParentUser(
        user,
        order.userId,
        'manageGroceryOrders',
      ))
    ) {
      throw new ForbiddenException('You do not have access to this order');
    }

    if (dto.action !== GroceryOrderAction.CANCEL) {
      throw new BadRequestException('Unsupported order action');
    }

    const updated = await this.prisma.groceryOrder.update({
      where: { id: orderId },
      data: { status: GroceryOrderStatus.CANCELLED },
      include: groceryOrderInclude(),
    });

    return {
      success: true,
      message: 'Grocery order updated successfully',
      data: formatGroceryOrder(updated),
    };
  }

  private async getSelectableShoppingItems(userId: string, itemIds?: string[]) {
    const where = {
      userId,
      status: {
        in: [ShoppingListItemStatus.NEEDED, ShoppingListItemStatus.OPTIONAL, ShoppingListItemStatus.ADDED_TO_VOUCHER],
      },
      ...(itemIds?.length ? { id: { in: itemIds } } : {}),
    };

    return this.prisma.shoppingListItem.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  private buildQuotedItem(item: any, storeName?: string) {
    const quantityNumber = this.parseQuantity(item.quantity);
    const unitPrice = this.estimateUnitPrice(item.category, storeName);
    const totalPrice = Number((quantityNumber * unitPrice).toFixed(2));

    return {
      id: item.id,
      name: item.name,
      unit: item.unit,
      quantity: item.quantity,
      category: item.category,
      note: item.note,
      price: totalPrice,
      unitPrice,
    };
  }

  private calculatePricing(items: Array<{ price: number }>) {
    const subtotal = Number(
      items.reduce((sum, item) => sum + item.price, 0).toFixed(2),
    );
    const onlineDiscount = Number((subtotal * 0.05).toFixed(2));
    const deliveryFee = subtotal >= 80 ? 0 : 2.5;
    const total = Number((subtotal - onlineDiscount + deliveryFee).toFixed(2));

    return {
      subtotal,
      onlineDiscount,
      deliveryFee,
      total,
      currency: 'AED',
    };
  }

  private estimateUnitPrice(category: KitchenItemCategory, storeName?: string) {
    const storeMultiplier =
      storeName?.toLowerCase().includes('carrefour') ? 1.08 : 1;
    const map: Record<KitchenItemCategory, number> = {
      PRODUCE: 3.6,
      DAIRY: 6.2,
      BAKERY: 4.8,
      PANTRY: 5.4,
      BABY: 12.5,
      FRUIT: 4.4,
      MEAT: 10.8,
      OTHER: 5,
    };

    return Number((map[category] * storeMultiplier).toFixed(2));
  }

  private parseQuantity(quantity: string) {
    const num = Number(String(quantity).replace(/[^\d.]/g, ''));
    if (!Number.isFinite(num) || num <= 0) {
      return 1;
    }
    return num >= 100 ? Number((num / 100).toFixed(2)) : num;
  }

  private estimateDeliveryTime() {
    const eta = new Date();
    eta.setHours(eta.getHours() + 6);
    return eta;
  }

  private generateOrderCode() {
    return `AL-${new Date().getUTCFullYear()}-${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`;
  }

  private generateTrackingCode() {
    return `TRK-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  }

}
