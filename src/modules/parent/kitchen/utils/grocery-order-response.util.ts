import { GroceryOrderStatus, PaymentMethodType } from '@prisma/client';

export function groceryOrderInclude() {
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

export function formatStore(
  store: any,
  savings?: {
    savingsAmount?: number;
    savingsPercent?: number;
    savingsCurrency?: string;
    savingsSubtitle?: string;
    deliveryLabel?: string;
  } | null,
) {
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
    savingsAmount: savings?.savingsAmount ?? null,
    savingsPercent: savings?.savingsPercent ?? null,
    savingsCurrency: savings?.savingsCurrency ?? null,
    savingsSubtitle: savings?.savingsSubtitle ?? null,
    deliveryLabel:
      savings?.deliveryLabel ||
      (store.name?.toLowerCase().includes('carrefour')
        ? 'Save 5% when you spend over 100 AED'
        : 'Partner store available for family delivery'),
  };
}

export function formatGroceryOrder(order: any, payment?: any) {
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
    store: formatStore(order.store),
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
    trackingTimeline: buildTrackingTimeline(order),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function buildTrackingTimeline(order: any) {
  const createdAt = order.createdAt;
  const updatedAt = order.updatedAt;
  const isCashOnDelivery =
    order.paymentType === PaymentMethodType.CASH_ON_DELIVERY;

  return [
    {
      key: 'PAYMENT_CONFIRMED',
      title: isCashOnDelivery
        ? 'Payment pending (Cash on Delivery)'
        : 'Payment confirmed',
      active:
        !isCashOnDelivery &&
        [
          GroceryOrderStatus.ORDER_CONFIRMED,
          GroceryOrderStatus.OUT_FOR_DELIVERY,
          GroceryOrderStatus.DELIVERED,
        ].includes(order.status),
      timestamp: isCashOnDelivery ? null : createdAt,
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
