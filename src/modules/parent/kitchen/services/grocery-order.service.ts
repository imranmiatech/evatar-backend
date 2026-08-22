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
  UpdatePartnerGroceryOrderDto,
} from '../dto/grocery-order.dto';
import { KitchenAccessService } from './kitchen-access.service';

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
        stores: stores.map((store) => this.formatStore(store)),
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
        selectedStore: selectedStore ? this.formatStore(selectedStore) : null,
        storeOptions: stores.map((store) => this.formatStore(store)),
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
        include: this.orderInclude(),
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
      include: this.orderInclude(),
    });

    return {
      success: true,
      message: 'Grocery order created successfully',
      data: this.formatOrder(freshOrder!),
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
      include: this.orderInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      message: 'Grocery orders fetched successfully',
      data: orders.map((order) => this.formatOrder(order)),
    };
  }

  async getOrderById(user: CurrentUserPayload, orderId: string) {
    const order = await this.prisma.groceryOrder.findUnique({
      where: { id: orderId },
      include: this.orderInclude(),
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
      data: this.formatOrder(order),
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
      include: this.orderInclude(),
    });

    return {
      success: true,
      message: 'Grocery order updated successfully',
      data: this.formatOrder(updated),
    };
  }

  async listPartnerOrders(user: CurrentUserPayload) {
    if (user.role !== UserRole.PARTNER) {
      throw new ForbiddenException('Only partner users can access store orders');
    }

    const orders = await this.prisma.groceryOrder.findMany({
      where: { store: { userId: user.userId } },
      include: this.orderInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      message: 'Partner grocery orders fetched successfully',
      data: orders.map((order) => this.formatOrder(order)),
    };
  }

  async getPartnerOrderById(user: CurrentUserPayload, orderId: string) {
    if (user.role !== UserRole.PARTNER) {
      throw new ForbiddenException('Only partner users can access store orders');
    }

    const order = await this.prisma.groceryOrder.findFirst({
      where: { id: orderId, store: { userId: user.userId } },
      include: this.orderInclude(),
    });

    if (!order) {
      throw new NotFoundException('Partner grocery order not found');
    }

    return {
      success: true,
      message: 'Partner grocery order fetched successfully',
      data: this.formatOrder(order),
    };
  }

  async updatePartnerOrder(
    user: CurrentUserPayload,
    orderId: string,
    dto: UpdatePartnerGroceryOrderDto,
  ) {
    if (user.role !== UserRole.PARTNER) {
      throw new ForbiddenException('Only partner users can update store orders');
    }

    const order = await this.prisma.groceryOrder.findFirst({
      where: { id: orderId, store: { userId: user.userId } },
    });

    if (!order) {
      throw new NotFoundException('Partner grocery order not found');
    }

    const updated = await this.prisma.groceryOrder.update({
      where: { id: orderId },
      data: { status: dto.status },
      include: this.orderInclude(),
    });

    return {
      success: true,
      message: 'Partner grocery order updated successfully',
      data: this.formatOrder(updated),
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

  private orderInclude() {
    return {
      items: true,
      store: {
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
      },
      transactions: {
        orderBy: { createdAt: 'desc' as const },
      },
    };
  }

  private formatStore(store: any) {
    return {
      id: store.id,
      name: store.name,
      logoUrl: store.logoUrl,
      description: store.description,
      address: store.address,
      city: store.city,
      partner: {
        id: store.user.id,
        name: store.user.fullName,
        email: store.user.email,
        phoneNumber: store.user.phoneNumber,
      },
      deliveryLabel:
        store.name?.toLowerCase().includes('carrefour')
          ? 'Save 5% when you spend over 100 AED'
          : 'Partner store available for family delivery',
    };
  }

  private formatOrder(order: any, payment?: any) {
    return {
      id: order.id,
      orderId: order.orderId,
      trackingCode: order.trackingCode,
      status: order.status,
      paymentType: order.paymentType,
      transactionId: order.transactionId,
      finalNote: order.finalNote,
      deliveryAddress: order.deliveryAddress,
      receiverPhone: order.receiverPhone,
      estimatedDeliveryAt: order.estimatedDeliveryAt,
      pricing: {
        subtotal: order.subtotal,
        onlineDiscount: order.onlineDiscount,
        deliveryFee: order.deliveryFee,
        total: order.total,
        currency: 'AED',
      },
      store: this.formatStore(order.store),
      items: order.items.map((item: any) => ({
        id: item.id,
        name: item.name,
        unit: item.unit,
        quantity: item.quantity,
        category: item.category,
        note: item.note,
        price: item.price,
      })),
      payment:
        payment?.data ??
        (order.transactions?.[0]
          ? {
              transactionId: order.transactions[0].id,
              paymentIntentId: order.transactions[0].paymentIntentId,
              amount: order.transactions[0].amount,
              currency: order.transactions[0].currency,
              status: order.transactions[0].status,
            }
          : null),
      trackingTimeline: this.buildTrackingTimeline(order),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  private buildTrackingTimeline(order: any) {
    const createdAt = order.createdAt;
    const updatedAt = order.updatedAt;

    return [
      {
        key: 'PAYMENT_CONFIRMED',
        title: 'Payment confirmed',
        active: [
          GroceryOrderStatus.ORDER_CONFIRMED,
          GroceryOrderStatus.OUT_FOR_DELIVERY,
          GroceryOrderStatus.DELIVERED,
        ].includes(order.status),
        timestamp: createdAt,
      },
      {
        key: 'ORDER_CONFIRMED',
        title: 'Order confirmed',
        active: [
          GroceryOrderStatus.ORDER_CONFIRMED,
          GroceryOrderStatus.OUT_FOR_DELIVERY,
          GroceryOrderStatus.DELIVERED,
        ].includes(order.status),
        timestamp: updatedAt,
      },
      {
        key: 'OUT_FOR_DELIVERY',
        title: 'Out for delivery',
        active: [
          GroceryOrderStatus.OUT_FOR_DELIVERY,
          GroceryOrderStatus.DELIVERED,
        ].includes(order.status),
        timestamp: updatedAt,
      },
      {
        key: 'DELIVERED',
        title: 'Delivered',
        active: order.status === GroceryOrderStatus.DELIVERED,
        timestamp: updatedAt,
      },
    ];
  }
}
