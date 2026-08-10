import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  KitchenInventoryItemStatus,
  ShoppingListItemStatus,
} from '@prisma/client';
import { CreateShoppingItemDto } from '../dto/create-shopping-item.dto';
import { UpdateShoppingItemDto } from '../dto/update-shopping-item.dto';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { KitchenAccessService } from './kitchen-access.service';

@Injectable()
export class ShoppingListService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kitchenAccess: KitchenAccessService,
  ) {}

  private formatItem(item: any) {
    const { createdByUser, ...rest } = item;

    return {
      ...rest,
      ownerStatus: createdByUser?.role ?? null,
    };
  }

  async create(user: CurrentUserPayload, dto: CreateShoppingItemDto) {
    const targetUserId = await this.kitchenAccess.resolveWritableParentUserId(
      user,
      dto.userId,
      dto.isCustomOrder ? 'groceryOrdering' : 'manageGroceryLists',
    );

    const item = await this.prisma.$transaction(async (tx) => {
      const shoppingItem = await tx.shoppingListItem.create({
        data: {
          userId: targetUserId,
          createdByUserId: user.userId,
          name: dto.name,
          unit: dto.unit,
          quantity: dto.quantity,
          category: dto.category,
          note: dto.note,
          isCustomOrder: dto.isCustomOrder ?? false,
          addedToKitchen: dto.addToKitchen ?? false,
          status: dto.isCustomOrder
            ? ShoppingListItemStatus.ADDED_TO_VOUCHER
            : ShoppingListItemStatus.NEEDED,
        },
        include: {
          createdByUser: {
            select: { role: true },
          },
        },
      });

      if (dto.addToKitchen) {
        await tx.kitchenItem.create({
          data: {
            userId: targetUserId,
            createdByUserId: user.userId,
            name: dto.name,
            unit: dto.unit,
            quantity: Number.isFinite(Number(dto.quantity))
              ? Number(dto.quantity)
              : undefined,
            category: dto.category,
            notes: dto.note,
            currentStockPercent: 100,
            status: KitchenInventoryItemStatus.IN_STOCK,
            lastStockedAt: new Date(),
          },
        });
      }

      return shoppingItem;
    });

    return {
      message: dto.isCustomOrder
        ? 'Custom order added to shopping voucher list successfully'
        : 'Shopping item added successfully',
      data: this.formatItem(item),
    };
  }

  async findAll(user: CurrentUserPayload, query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const readableParentIds = await this.kitchenAccess.resolveReadableParentUserIds(
      user,
      'manageGroceryLists',
    );
    const where = readableParentIds ? { userId: { in: readableParentIds } } : {};

    const [items, total] = await Promise.all([
      this.prisma.shoppingListItem.findMany({
        where,
        include: {
          createdByUser: {
            select: { role: true },
          },
        },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.shoppingListItem.count({ where }),
    ]);

    const formattedItems = items.map((item) => this.formatItem(item));

    return {
      message: 'Shopping list fetched successfully',
      data: formattedItems,
      shoppingVoucherList: formattedItems.filter(
        (item) =>
          item.isCustomOrder ||
          item.status === ShoppingListItemStatus.ADDED_TO_VOUCHER,
      ),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(user: CurrentUserPayload, id: string) {
    const item = await this.prisma.shoppingListItem.findUnique({
      where: { id },
      include: {
        createdByUser: {
          select: { role: true },
        },
      },
    });

    if (!item) throw new NotFoundException('Shopping item not found');
    if (!(await this.kitchenAccess.canAccessParentUser(user, item.userId)))
      throw new ForbiddenException('You do not have access to this item');

    return {
      message: 'Shopping item fetched successfully',
      data: this.formatItem(item),
    };
  }

  async update(user: CurrentUserPayload, id: string, dto: UpdateShoppingItemDto) {
    const item = await this.prisma.shoppingListItem.findUnique({ where: { id } });

    if (!item) throw new NotFoundException('Shopping item not found');
    if (!(await this.kitchenAccess.canAccessParentUser(user, item.userId)))
      throw new ForbiddenException('You do not have access to this item');

    const updated = await this.prisma.shoppingListItem.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.quantity !== undefined && { quantity: dto.quantity }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.note !== undefined && { note: dto.note }),
      },
      include: {
        createdByUser: {
          select: { role: true },
        },
      },
    });

    return {
      message: 'Shopping item updated successfully',
      data: this.formatItem(updated),
    };
  }

  async remove(user: CurrentUserPayload, id: string) {
    const item = await this.prisma.shoppingListItem.findUnique({ where: { id } });

    if (!item) throw new NotFoundException('Shopping item not found');
    if (!(await this.kitchenAccess.canAccessParentUser(user, item.userId)))
      throw new ForbiddenException('You do not have access to this item');

    await this.prisma.shoppingListItem.delete({ where: { id } });

    return { message: 'Shopping item deleted successfully' };
  }
}
