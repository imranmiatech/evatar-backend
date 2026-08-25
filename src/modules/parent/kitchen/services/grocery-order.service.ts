import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import PDFDocument from 'pdfkit';
import {
  GroceryOrderStatus,
  KitchenItemCategory,
  PaymentMethodType,
  ShoppingListItemStatus,
  UserRole,
} from '@prisma/client';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { MyOfferService } from '../../../myoffer/my-offer.service';
import { PaymentAccountService } from '../../../payment/payment-account.service';
import { PaymentService } from '../../../payment/payment.service';
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
    private readonly myOfferService: MyOfferService,
    private readonly paymentAccountService: PaymentAccountService,
    private readonly paymentService: PaymentService,
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
    const data = await this.buildCheckoutPreviewData(user, dto);
    return {
      success: true,
      message: 'Shopping voucher preview generated successfully',
      data,
    };
  }

  async getPreviewVoucherPdf(
    user: CurrentUserPayload,
    dto: GroceryCheckoutPreviewDto,
  ) {
    const preview = await this.buildCheckoutPreviewData(user, dto);
    const buffer = await this.buildVoucherPdfBuffer({
      voucherCode: preview.voucherCode,
      voucherDate: preview.voucherDate,
      items: preview.voucherItems,
      pricing: preview.pricing,
      finalNote: dto.finalNote?.trim() || preview.finalNote || '',
      store: preview.selectedStore,
    });

    return {
      filename: `shopping-voucher-${preview.voucherCode.toLowerCase()}.pdf`,
      contentType: 'application/pdf',
      buffer,
    };
  }

  async createOrder(user: CurrentUserPayload, dto: CreateGroceryOrderDto) {
    const payerUserId = user.userId || user.id!;
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

    const effectiveOfferId =
      dto.paymentType === PaymentMethodType.ONLINE ? dto.offerId : undefined;

    if (effectiveOfferId) {
      await this.myOfferService.validateOnlineOfferEligibility(
        payerUserId,
        effectiveOfferId,
      );
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

    let paymentResult: { data?: any } | null = null;
    let nextStatus =
      dto.paymentType === PaymentMethodType.CASH_ON_DELIVERY
        ? GroceryOrderStatus.ORDER_CONFIRMED
        : GroceryOrderStatus.STORE_REVIEWED;

    if (dto.paymentType === PaymentMethodType.ONLINE) {
      paymentResult = await this.paymentService.createGroceryOrderPaymentIntent(
        payerUserId,
        {
          groceryOrderId: order.id,
          offerId: effectiveOfferId,
          currency: pricing.currency,
          paymentMethodId: dto.paymentMethodId,
        },
      );
    } else {
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
      data: formatGroceryOrder(freshOrder!, paymentResult),
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

  async getOrderInvoicePdf(user: CurrentUserPayload, orderId: string) {
    const payload = await this.getOrderById(user, orderId);
    const order = payload.data;
    const buffer = await this.buildVoucherPdfBuffer({
      voucherCode: order.orderId,
      voucherDate: order.createdAt,
      items: order.items,
      pricing: order.pricing,
      finalNote: order.finalNote || '',
      store: order.store,
      title: 'Grocery Order Invoice',
      subtitle: `Tracking ${order.trackingCode || order.orderId}`,
      receiverPhone: order.receiverPhone,
      deliveryAddress: order.deliveryAddress,
    });

    return {
      filename: `grocery-invoice-${order.orderId.toLowerCase()}.pdf`,
      contentType: 'application/pdf',
      buffer,
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
        in: [
          ShoppingListItemStatus.NEEDED,
          ShoppingListItemStatus.OPTIONAL,
          ShoppingListItemStatus.ADDED_TO_VOUCHER,
        ],
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
    const storeMultiplier = storeName?.toLowerCase().includes('carrefour')
      ? 1.08
      : 1;
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

  private generateVoucherCode() {
    return `AL-${new Date().getUTCFullYear()}-${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`;
  }

  private async buildCheckoutPreviewData(
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

    const storeOptions = stores.map((store) => {
      const storePricedItems = shoppingItems.map((item) =>
        this.buildQuotedItem(item, store.name),
      );
      const storePricing = this.calculatePricing(storePricedItems);
      return formatStore(
        store,
        this.buildStoreSavingsSummary(
          storePricing.onlineDiscount,
          storePricing.currency,
          5,
          storePricedItems.length,
        ),
      );
    });

    const selectedStoreView = selectedStore
      ? formatStore(
          selectedStore,
          this.buildStoreSavingsSummary(
            pricing.onlineDiscount,
            pricing.currency,
            5,
            pricedItems.length,
          ),
        )
      : null;

    return {
      ownerUserId,
      voucherCode: this.generateVoucherCode(),
      voucherDate: new Date(),
      itemCount: pricedItems.length,
      voucherItems: pricedItems,
      finalNote: dto.finalNote?.trim() || '',
      selectedStore: selectedStoreView,
      storeOptions,
      paymentMethods,
      pricing,
    };
  }

  private buildStoreSavingsSummary(
    savingsAmount: number,
    currency: string,
    savingsPercent: number,
    productCount: number,
  ) {
    const roundedAmount = Number(savingsAmount || 0).toFixed(2);
    const productLabel = productCount === 1 ? 'product' : 'products';

    return {
      savingsAmount: Number(roundedAmount),
      savingsPercent,
      savingsCurrency: currency,
      savingsSubtitle: `Save ${savingsPercent}% (${currency} ${roundedAmount}) on your listed ${productCount} ${productLabel}`,
      deliveryLabel: `Save ${savingsPercent}% (${currency} ${roundedAmount}) on your listed ${productCount} ${productLabel}`,
    };
  }

  private async buildVoucherPdfBuffer(input: {
    voucherCode: string;
    voucherDate: Date | string;
    items: Array<{
      name: string;
      quantity: string;
      note?: string | null;
      price?: number;
    }>;
    pricing: {
      subtotal: number;
      onlineDiscount: number;
      deliveryFee: number;
      total: number;
      currency: string;
    };
    finalNote?: string;
    store?: {
      name?: string;
      deliveryLabel?: string;
      address?: string | null;
      city?: string | null;
    } | null;
    title?: string;
    subtitle?: string;
    receiverPhone?: string | null;
    deliveryAddress?: string | null;
  }) {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 42 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc
        .fontSize(22)
        .fillColor('#0b6673')
        .text(input.title || 'Shopping Voucher');
      doc
        .fontSize(11)
        .fillColor('#70808d')
        .text(
          input.subtitle ||
            `${new Date(input.voucherDate).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })} • ${input.items.length} items total`,
        );

      doc.moveDown(1);
      doc.roundedRect(42, doc.y, 511, 68, 12).strokeColor('#dbe7ea').stroke();
      doc
        .fontSize(14)
        .fillColor('#122433')
        .text(input.store?.name || 'Partner Store', 58, doc.y + 14);
      doc
        .fontSize(10)
        .fillColor('#70808d')
        .text(
          input.store?.deliveryLabel || 'Partner grocery delivery available',
          58,
          doc.y + 8,
        );

      doc.moveDown(3.4);
      doc.fontSize(12).fillColor('#122433').text('Voucher Items');
      doc.moveDown(0.4);

      input.items.forEach((item) => {
        const rowTop = doc.y;
        doc
          .fontSize(11)
          .fillColor('#122433')
          .text(item.name, 42, rowTop, { width: 280 });
        doc
          .fontSize(10)
          .fillColor('#70808d')
          .text(`Qty: ${item.quantity}`, 340, rowTop, {
            width: 80,
            align: 'right',
          });
        doc
          .fontSize(10)
          .fillColor('#0b6673')
          .text(
            `${input.pricing.currency} ${Number(item.price || 0).toFixed(2)}`,
            430,
            rowTop,
            { width: 90, align: 'right' },
          );
        if (item.note) {
          doc
            .fontSize(9)
            .fillColor('#70808d')
            .text(`Note: ${item.note}`, 42, rowTop + 16, { width: 360 });
        }
        doc
          .moveTo(42, rowTop + 34)
          .lineTo(553, rowTop + 34)
          .strokeColor('#eef3f5')
          .stroke();
        doc.y = rowTop + 42;
      });

      doc.moveDown(0.5);
      doc.fontSize(12).fillColor('#122433').text('Pricing Summary');
      doc.moveDown(0.4);
      this.writePdfPriceLine(
        doc,
        'Subtotal',
        `${input.pricing.currency} ${input.pricing.subtotal.toFixed(2)}`,
      );
      this.writePdfPriceLine(
        doc,
        'Online Discount (5%)',
        `- ${input.pricing.currency} ${input.pricing.onlineDiscount.toFixed(2)}`,
      );
      this.writePdfPriceLine(
        doc,
        'Delivery Fee',
        `${input.pricing.currency} ${input.pricing.deliveryFee.toFixed(2)}`,
      );
      this.writePdfPriceLine(
        doc,
        'Total',
        `${input.pricing.currency} ${input.pricing.total.toFixed(2)}`,
        true,
      );

      doc.moveDown(0.8);
      doc
        .fontSize(10)
        .fillColor('#70808d')
        .text(`Voucher ID: ${input.voucherCode}`);

      if (input.deliveryAddress) {
        doc.text(`Delivery address: ${input.deliveryAddress}`);
      }
      if (input.receiverPhone) {
        doc.text(`Receiver phone: ${input.receiverPhone}`);
      }
      if (input.store?.address || input.store?.city) {
        doc.text(
          `Store address: ${[input.store?.address, input.store?.city]
            .filter(Boolean)
            .join(', ')}`,
        );
      }
      if (input.finalNote) {
        doc.moveDown(0.5);
        doc.fontSize(11).fillColor('#122433').text('Final Note');
        doc.fontSize(10).fillColor('#70808d').text(input.finalNote);
      }

      doc.end();
    });
  }

  private writePdfPriceLine(
    doc: PDFKit.PDFDocument,
    label: string,
    value: string,
    strong = false,
  ) {
    const top = doc.y;
    doc
      .fontSize(strong ? 12 : 10)
      .fillColor(strong ? '#122433' : '#70808d')
      .text(label, 42, top);
    doc
      .fontSize(strong ? 12 : 10)
      .fillColor(strong ? '#122433' : '#0b6673')
      .text(value, 420, top, { width: 120, align: 'right' });
    doc.y = top + (strong ? 20 : 16);
  }
}
