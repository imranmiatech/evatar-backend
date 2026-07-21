import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import {
  AddRecipeToScheduleDto,
  CreateInventoryItemDto,
  CreatePaymentMethodDto,
  CreateShoppingListItemDto,
  CreateVoucherDto,
  UpdateInventoryItemDto,
  UpdateShoppingListItemDto,
} from './dto';
import type { KitchenPermission } from './types/kitchan.types';

@Injectable()
export class KitchanService {
  constructor(private readonly prisma: PrismaService) {}

  async listRecipes(mealType?: string, category?: string) {
    return this.prisma.recipe.findMany({
      where: {
        isPublished: true,
        mealType: mealType as any,
        category: category || undefined,
      },
      include: {
        ingredients: { orderBy: { sortOrder: 'asc' } },
        steps: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { title: 'asc' },
    });
  }

  async getRecipe(recipeId: string) {
    return this.prisma.recipe.findUniqueOrThrow({
      where: { id: recipeId },
      include: {
        ingredients: { orderBy: { sortOrder: 'asc' } },
        steps: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  async getMissingIngredients(
    user: CurrentUserPayload,
    recipeId: string,
    childId: string,
  ) {
    await this.ensureCanAccessChild(user, childId);
    const recipe = await this.getRecipe(recipeId);
    const inventory = await this.prisma.kitchenInventoryItem.findMany({
      where: { childId },
    });

    const inventoryByName = new Map(
      inventory.map((item) => [item.name.toLowerCase(), item]),
    );

    const missingIngredients = recipe.ingredients.filter((ingredient) => {
      if (ingredient.isOptional) return false;
      const key = (ingredient.inventoryName || ingredient.name).toLowerCase();
      const item = inventoryByName.get(key);
      return !item || item.status === 'MISSING' || item.currentStockPercent <= item.thresholdPercent;
    });

    return {
      recipeId,
      childId,
      missingIngredients,
      hasMissingIngredients: missingIngredients.length > 0,
    };
  }

  async addRecipeMissingToShoppingList(
    user: CurrentUserPayload,
    recipeId: string,
    childId: string,
  ) {
    const missing = await this.getMissingIngredients(user, recipeId, childId);
    const list = await this.ensureActiveShoppingList(user, childId);

    const created = await Promise.all(
      missing.missingIngredients.map((ingredient, index) =>
        this.prisma.shoppingListItem.create({
          data: {
            shoppingListId: list.id,
            recipeId,
            name: ingredient.inventoryName || ingredient.name,
            unit: ingredient.unit,
            quantity: ingredient.quantity,
            category: this.inferCategory(ingredient.name) as any,
            status: 'NEEDED',
            note: ingredient.allergenWarning,
            sortOrder: index,
          } as any,
        }),
      ),
    );

    await this.audit(user, childId, 'ADD_MISSING_INGREDIENTS', 'Recipe', recipeId, null, created);

    return {
      shoppingList: list,
      items: created,
    };
  }

  async addRecipeToSchedule(
    user: CurrentUserPayload,
    recipeId: string,
    dto: AddRecipeToScheduleDto,
  ) {
    const child = await this.ensureCanAccessChild(user, dto.childId);
    const recipe = await this.getRecipe(recipeId);
    const date = this.toDayDate(dto.date);
    const mealType = (dto.mealType || recipe.mealType || 'OTHER') as any;

    const dayPlan = await this.ensureDayPlan(child.id, child.parentUserId, user.userId, date);
    const activity = await this.prisma.dayActivity.create({
      data: {
        dayPlanId: dayPlan.id,
        category: mealType,
        title: recipe.title,
        description: dto.notes || recipe.description,
        startTime: dto.startTime ? new Date(dto.startTime) : undefined,
        endTime: dto.endTime ? new Date(dto.endTime) : undefined,
        status: 'PLANNED',
        imageUrl: recipe.imageUrl,
        detail: {
          nutrition: recipe.nutrition,
          safetyNotes: recipe.safetyNotes,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
        },
      } as any,
    });

    const schedule = await this.prisma.kitchenSchedule.create({
      data: {
        childId: child.id,
        parentUserId: child.parentUserId,
        createdByUserId: user.userId,
        recipeId,
        dayActivityId: activity.id,
        date,
        mealType,
        title: recipe.title,
        notes: dto.notes,
        startTime: dto.startTime ? new Date(dto.startTime) : undefined,
        endTime: dto.endTime ? new Date(dto.endTime) : undefined,
      } as any,
    });

    await this.audit(user, child.id, 'ADD_RECIPE_TO_SCHEDULE', 'Recipe', recipeId, null, {
      schedule,
      activity,
    });

    return { schedule, dayActivity: activity };
  }

  async listInventory(user: CurrentUserPayload, childId: string, status?: string) {
    await this.ensureCanAccessChild(user, childId);
    return this.prisma.kitchenInventoryItem.findMany({
      where: {
        childId,
        status: status as any,
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
  }

  async createInventory(user: CurrentUserPayload, dto: CreateInventoryItemDto) {
    const child = await this.ensureCanAccessChild(user, dto.childId, 'canManageInventory');
    const item = await this.prisma.kitchenInventoryItem.create({
      data: {
        childId: child.id,
        parentUserId: child.parentUserId,
        createdByUserId: user.userId,
        lastUpdatedByUserId: user.userId,
        name: dto.name,
        unit: dto.unit,
        quantity: dto.quantity,
        category: (dto.category || 'OTHER') as any,
        status: (dto.status || this.statusFromPercent(dto.currentStockPercent)) as any,
        currentStockPercent: dto.currentStockPercent ?? 100,
        thresholdPercent: dto.thresholdPercent ?? 25,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        lastStockedAt: new Date(),
        notes: dto.notes,
      } as any,
    });

    await this.audit(user, child.id, 'CREATE_INVENTORY_ITEM', 'KitchenInventoryItem', item.id, null, item);
    return item;
  }

  async updateInventory(
    user: CurrentUserPayload,
    itemId: string,
    dto: UpdateInventoryItemDto,
  ) {
    const existing = await this.prisma.kitchenInventoryItem.findUniqueOrThrow({
      where: { id: itemId },
    });
    await this.ensureCanAccessChild(user, existing.childId, 'canManageInventory');

    const updated = await this.prisma.kitchenInventoryItem.update({
      where: { id: itemId },
      data: {
        name: dto.name,
        unit: dto.unit,
        quantity: dto.quantity,
        category: dto.category as any,
        status: (dto.status || (dto.currentStockPercent !== undefined
          ? this.statusFromPercent(dto.currentStockPercent)
          : undefined)) as any,
        currentStockPercent: dto.currentStockPercent,
        thresholdPercent: dto.thresholdPercent,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        notes: dto.notes,
        lastUpdatedByUserId: user.userId,
      },
    });

    await this.audit(user, existing.childId, 'UPDATE_INVENTORY_ITEM', 'KitchenInventoryItem', itemId, existing, updated);
    return updated;
  }

  async deleteInventory(user: CurrentUserPayload, itemId: string) {
    const existing = await this.prisma.kitchenInventoryItem.findUniqueOrThrow({
      where: { id: itemId },
    });
    const child = await this.ensureCanAccessChild(user, existing.childId, 'canManageInventory');

    if (
      user.role === 'NANNY' &&
      existing.createdByUserId !== user.userId
    ) {
      throw new ForbiddenException('Nanny can only delete inventory items they added');
    }

    await this.prisma.kitchenInventoryItem.delete({ where: { id: itemId } });
    await this.audit(user, child.id, 'DELETE_INVENTORY_ITEM', 'KitchenInventoryItem', itemId, existing, null);
    return { message: 'Inventory item deleted successfully' };
  }

  async getShoppingList(user: CurrentUserPayload, childId: string) {
    await this.ensureCanAccessChild(user, childId, 'canCreateShoppingList');
    return this.ensureActiveShoppingList(user, childId);
  }

  async addShoppingListItem(
    user: CurrentUserPayload,
    dto: CreateShoppingListItemDto,
  ) {
    const list = await this.ensureActiveShoppingList(user, dto.childId);
    const item = await this.prisma.shoppingListItem.create({
      data: {
        shoppingListId: list.id,
        name: dto.name,
        unit: dto.unit,
        quantity: dto.quantity,
        category: (dto.category || 'OTHER') as any,
        status: (dto.status || 'NEEDED') as any,
        note: dto.note,
      } as any,
    });

    await this.audit(user, dto.childId, 'ADD_SHOPPING_ITEM', 'ShoppingListItem', item.id, null, item);
    return item;
  }

  async updateShoppingListItem(
    user: CurrentUserPayload,
    itemId: string,
    dto: UpdateShoppingListItemDto,
  ) {
    const existing = await this.prisma.shoppingListItem.findUniqueOrThrow({
      where: { id: itemId },
      include: { shoppingList: true },
    });
    await this.ensureCanAccessChild(user, existing.shoppingList.childId, 'canCreateShoppingList');

    const updated = await this.prisma.shoppingListItem.update({
      where: { id: itemId },
      data: {
        name: dto.name,
        unit: dto.unit,
        quantity: dto.quantity,
        category: dto.category as any,
        status: dto.status as any,
        note: dto.note,
      },
    });

    await this.audit(user, existing.shoppingList.childId, 'UPDATE_SHOPPING_ITEM', 'ShoppingListItem', itemId, existing, updated);
    return updated;
  }

  async deleteShoppingListItem(user: CurrentUserPayload, itemId: string) {
    const existing = await this.prisma.shoppingListItem.findUniqueOrThrow({
      where: { id: itemId },
      include: { shoppingList: true },
    });
    await this.ensureCanAccessChild(user, existing.shoppingList.childId, 'canCreateShoppingList');
    await this.prisma.shoppingListItem.delete({ where: { id: itemId } });
    await this.audit(user, existing.shoppingList.childId, 'DELETE_SHOPPING_ITEM', 'ShoppingListItem', itemId, existing, null);
    return { message: 'Shopping list item deleted successfully' };
  }

  async listStores() {
    return this.prisma.kitchenStore.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async createVoucher(user: CurrentUserPayload, dto: CreateVoucherDto) {
    const child = await this.ensureCanAccessChild(user, dto.childId, 'canSendVoucher');
    const shoppingList: any = dto.shoppingListId
      ? await this.prisma.shoppingList.findUniqueOrThrow({
          where: { id: dto.shoppingListId },
          include: { items: true },
        })
      : await this.ensureActiveShoppingList(user, dto.childId);

    if (shoppingList.childId !== dto.childId) {
      throw new BadRequestException('Shopping list does not belong to this child');
    }

    const items = 'items' in shoppingList
      ? shoppingList.items
      : await this.prisma.shoppingListItem.findMany({ where: { shoppingListId: shoppingList.id } });

    return this.prisma.$transaction(async (tx) => {
      const voucher = await tx.shoppingVoucher.create({
        data: {
          voucherCode: `KV-${Date.now().toString(36).toUpperCase()}`,
          childId: child.id,
          parentUserId: child.parentUserId,
          createdByUserId: user.userId,
          shoppingListId: shoppingList.id,
          storeId: dto.storeId,
          status: 'DRAFT',
          messageToParent: dto.messageToParent,
          messageToStore: dto.messageToStore,
          allergyWarnings: dto.allergyWarnings ?? [],
          substitutionRules: dto.substitutionRules,
        } as any,
      });

      await tx.shoppingVoucherItem.createMany({
        data: items
          .filter((item) => item.status !== 'REMOVED')
          .map((item, index) => ({
            voucherId: voucher.id,
            shoppingListItemId: item.id,
            recipeId: item.recipeId,
            name: item.name,
            unit: item.unit,
            quantity: item.quantity,
            note: item.note,
            sortOrder: index,
          })),
      });

      await tx.shoppingListItem.updateMany({
        where: {
          shoppingListId: shoppingList.id,
          status: { in: ['NEEDED', 'OPTIONAL'] },
        },
        data: { status: 'ADDED_TO_VOUCHER' },
      });

      await tx.kitchenAuditLog.create({
        data: {
          childId: child.id,
          userId: user.userId,
          action: 'CREATE_VOUCHER',
          entityType: 'ShoppingVoucher',
          entityId: voucher.id,
          after: voucher,
        } as any,
      });

      return tx.shoppingVoucher.findUniqueOrThrow({
        where: { id: voucher.id },
        include: { items: true, store: true, shoppingList: true },
      });
    });
  }

  async getVoucher(user: CurrentUserPayload, voucherId: string) {
    const voucher = await this.prisma.shoppingVoucher.findUniqueOrThrow({
      where: { id: voucherId },
      include: { items: true, store: true, shoppingList: true, order: true },
    });
    await this.ensureCanAccessChild(user, voucher.childId);
    return voucher;
  }

  async updateVoucherStatus(
    user: CurrentUserPayload,
    voucherId: string,
    status: 'SENT_TO_PARENT' | 'SENT_TO_STORE',
  ) {
    const voucher = await this.getVoucher(user, voucherId);
    await this.ensureCanAccessChild(user, voucher.childId, 'canSendVoucher');

    return this.prisma.shoppingVoucher.update({
      where: { id: voucherId },
      data: {
        status,
        sentToParentAt: status === 'SENT_TO_PARENT' ? new Date() : undefined,
        sentToStoreAt: status === 'SENT_TO_STORE' ? new Date() : undefined,
      } as any,
      include: { items: true, store: true },
    });
  }

  async createOrderFromVoucher(user: CurrentUserPayload, voucherId: string) {
    const voucher = await this.getVoucher(user, voucherId);
    const child = await this.ensureCanAccessChild(user, voucher.childId, 'canSendVoucher');

    const existing = await this.prisma.groceryOrder.findUnique({
      where: { voucherId },
    });
    if (existing) return this.getOrder(user, existing.id);

    const voucherItems = await this.prisma.shoppingVoucherItem.findMany({
      where: { voucherId },
    });
    const subtotalCents = voucherItems.reduce(
      (sum, item) => sum + (item.estimatedPriceCents ?? 0),
      0,
    );

    return this.prisma.groceryOrder.create({
      data: {
        orderNumber: `KO-${Date.now().toString(36).toUpperCase()}`,
        voucherId,
        childId: child.id,
        parentUserId: child.parentUserId,
        createdByUserId: user.userId,
        storeId: voucher.storeId,
        status: 'VOUCHER_SENT',
        subtotalCents,
        deliveryFeeCents: 0,
        totalCents: subtotalCents,
        trackingEvents: [
          {
            status: 'VOUCHER_SENT',
            label: 'Voucher Sent',
            at: new Date().toISOString(),
          },
        ],
        items: {
          create: voucherItems.map((item) => ({
            recipeId: item.recipeId,
            name: item.name,
            unit: item.unit,
            quantity: item.quantity,
            priceCents: item.estimatedPriceCents ?? 0,
          })),
        },
      } as any,
      include: { items: true, voucher: true, store: true },
    });
  }

  async listOrders(user: CurrentUserPayload, childId?: string) {
    if (childId) await this.ensureCanAccessChild(user, childId);
    return this.prisma.groceryOrder.findMany({
      where: { childId },
      include: { items: true, store: true, voucher: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrder(user: CurrentUserPayload, orderId: string) {
    const order = await this.prisma.groceryOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true, store: true, voucher: true, paymentMethod: true },
    });
    await this.ensureCanAccessChild(user, order.childId);
    return order;
  }

  async cancelOrder(user: CurrentUserPayload, orderId: string) {
    const order = await this.getOrder(user, orderId);
    await this.ensureCanAccessChild(user, order.childId);
    return this.prisma.groceryOrder.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
      include: { items: true },
    });
  }

  async confirmPayment(
    user: CurrentUserPayload,
    orderId: string,
    paymentMethodId?: string,
  ) {
    this.ensureParentOrAdmin(user);
    const order = await this.getOrder(user, orderId);
    const child = await this.ensureParentOwnsChild(user, order.childId);

    return this.prisma.groceryOrder.update({
      where: { id: orderId },
      data: {
        paymentMethodId,
        parentUserId: child.parentUserId,
        status: 'ORDER_CONFIRMED',
        confirmedAt: new Date(),
      },
      include: { items: true, paymentMethod: true },
    });
  }

  async createStripeCheckoutSession(
    user: CurrentUserPayload,
    orderId: string,
  ) {
    this.ensureParentOrAdmin(user);
    const order = await this.getOrder(user, orderId);
    await this.ensureParentOwnsChild(user, order.childId);

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new BadRequestException('STRIPE_SECRET_KEY is not configured');
    }

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5000').replace(
      /\/$/,
      '',
    );
    const params = new URLSearchParams();

    params.set('mode', 'payment');
    params.set('client_reference_id', order.id);
    params.set('metadata[orderId]', order.id);
    params.set('metadata[childId]', order.childId);
    params.set(
      'success_url',
      `${frontendUrl}/kitchen/payment-success?orderId=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
    );
    params.set(
      'cancel_url',
      `${frontendUrl}/kitchen/payment-cancelled?orderId=${order.id}`,
    );

    const payableItems = order.items.length
      ? order.items
      : [
          {
            name: `Kitchen order ${order.orderNumber}`,
            quantity: 1,
            priceCents: order.totalCents || 100,
          },
        ];

    payableItems.forEach((item, index) => {
      params.set(`line_items[${index}][quantity]`, String(Math.max(1, Math.ceil(item.quantity || 1))));
      params.set(`line_items[${index}][price_data][currency]`, 'usd');
      params.set(
        `line_items[${index}][price_data][unit_amount]`,
        String(Math.max(100, item.priceCents || 100)),
      );
      params.set(`line_items[${index}][price_data][product_data][name]`, item.name);
    });

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new BadRequestException({
        message: 'Failed to create Stripe checkout session',
        stripeError: payload?.error?.message || payload,
      });
    }

    await this.audit(user, order.childId, 'CREATE_STRIPE_CHECKOUT_SESSION', 'GroceryOrder', order.id, null, {
      sessionId: payload.id,
      url: payload.url,
    });

    return {
      sessionId: payload.id,
      checkoutUrl: payload.url,
      orderId: order.id,
    };
  }

  async confirmReceived(user: CurrentUserPayload, orderId: string) {
    const order = await this.getOrder(user, orderId);
    await this.ensureCanAccessChild(user, order.childId, 'canConfirmDelivery');

    return this.prisma.groceryOrder.update({
      where: { id: orderId },
      data: {
        status: 'DELIVERED',
        deliveredAt: new Date(),
      },
      include: { items: true },
    });
  }

  async listPaymentMethods(user: CurrentUserPayload) {
    this.ensureParentOrAdmin(user);
    return this.prisma.paymentMethod.findMany({
      where: {
        parentUserId: user.userId,
        status: 'ACTIVE',
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createPaymentMethod(
    user: CurrentUserPayload,
    dto: CreatePaymentMethodDto,
  ) {
    this.ensureParentOrAdmin(user);
    if (dto.isDefault) {
      await this.prisma.paymentMethod.updateMany({
        where: { parentUserId: user.userId },
        data: { isDefault: false },
      });
    }

    return this.prisma.paymentMethod.create({
      data: {
        parentUserId: user.userId,
        type: dto.type as any,
        label: dto.label,
        brand: dto.brand,
        last4: dto.last4,
        expiryMonth: dto.expiryMonth,
        expiryYear: dto.expiryYear,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async deletePaymentMethod(user: CurrentUserPayload, paymentMethodId: string) {
    this.ensureParentOrAdmin(user);
    const method = await this.prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, parentUserId: user.userId },
    });

    if (!method) throw new NotFoundException('Payment method not found');

    return this.prisma.paymentMethod.update({
      where: { id: paymentMethodId },
      data: { status: 'ARCHIVED' },
    });
  }

  private ensureParentOrAdmin(user: CurrentUserPayload) {
    if (!['PARENT', 'ADMIN'].includes(user.role)) {
      throw new ForbiddenException('Only parents can perform this action');
    }
  }

  private async ensureCanAccessChild(
    user: CurrentUserPayload,
    childId: string,
    permission?: KitchenPermission,
  ) {
    if (user.role === 'ADMIN') {
      return this.prisma.child.findUniqueOrThrow({ where: { id: childId } });
    }

    if (user.role === 'PARENT') {
      return this.ensureParentOwnsChild(user, childId);
    }

    if (user.role === 'NANNY') {
      const access = await this.getKitchenAccess(user.userId, childId);
      if (!access) {
        throw new ForbiddenException('Nanny is not assigned to this child kitchen');
      }
      if (permission && !access[permission]) {
        throw new ForbiddenException('Nanny does not have this kitchen permission');
      }
      return access.child;
    }

    throw new ForbiddenException('Invalid role for kitchen access');
  }

  private async ensureParentOwnsChild(user: CurrentUserPayload, childId: string) {
    const child = await this.prisma.child.findFirst({
      where: {
        id: childId,
        parentUserId: user.role === 'ADMIN' ? undefined : user.userId,
      },
    });

    if (!child) throw new NotFoundException('Child profile not found');
    return child;
  }

  private async getKitchenAccess(nannyUserId: string, childId: string) {
    const access = await this.prisma.kitchenAccess.findUnique({
      where: {
        nannyUserId_childId: {
          nannyUserId,
          childId,
        },
      },
      include: { child: true },
    });

    if (access) return access;

    const nannyLink = await this.prisma.nannyChildLink.findUnique({
      where: {
        nannyUserId_childId: {
          nannyUserId,
          childId,
        },
      },
      include: { child: true },
    });

    if (!nannyLink) return null;

    return {
      child: nannyLink.child,
      canViewInventory: true,
      canManageInventory: true,
      canCreateShoppingList: true,
      canSendVoucher: true,
      canConfirmDelivery: true,
    };
  }

  private async ensureActiveShoppingList(
    user: CurrentUserPayload,
    childId: string,
  ) {
    const child = await this.ensureCanAccessChild(user, childId, 'canCreateShoppingList');
    const existing = await this.prisma.shoppingList.findFirst({
      where: { childId, isActive: true },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    if (existing) return existing;

    return this.prisma.shoppingList.create({
      data: {
        childId,
        parentUserId: child.parentUserId,
        createdByUserId: user.userId,
        title: `${child.name}'s Shopping List`,
      },
      include: { items: true },
    });
  }

  private async ensureDayPlan(
    childId: string,
    parentUserId: string,
    createdByUserId: string,
    date: Date,
  ) {
    const existing = await this.prisma.dayPlan.findUnique({
      where: {
        childId_date: { childId, date },
      },
    });
    if (existing) return existing;

    return this.prisma.dayPlan.create({
      data: {
        childId,
        date,
        mode: 'MANUAL',
        status: 'READY',
        title: 'Kitchen Schedule',
        createdByUserId,
      } as any,
    });
  }

  private statusFromPercent(percent = 100) {
    if (percent <= 0) return 'MISSING';
    if (percent <= 25) return 'LOW';
    return 'IN_STOCK';
  }

  private inferCategory(name: string) {
    const lower = name.toLowerCase();
    if (lower.includes('milk') || lower.includes('yogurt')) return 'DAIRY';
    if (lower.includes('fish') || lower.includes('salmon') || lower.includes('egg')) return 'PROTEIN';
    if (lower.includes('banana') || lower.includes('berry') || lower.includes('spinach')) return 'PRODUCE';
    if (lower.includes('oat') || lower.includes('rice')) return 'PANTRY';
    return 'OTHER';
  }

  private toDayDate(date: string) {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Invalid date');
    return new Date(
      Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()),
    );
  }

  private async audit(
    user: CurrentUserPayload,
    childId: string | null,
    action: string,
    entityType: string,
    entityId?: string | null,
    before?: unknown,
    after?: unknown,
  ) {
    await this.prisma.kitchenAuditLog.create({
      data: {
        childId,
        userId: user.userId,
        action,
        entityType,
        entityId,
        before: before as any,
        after: after as any,
      },
    });
  }
}
