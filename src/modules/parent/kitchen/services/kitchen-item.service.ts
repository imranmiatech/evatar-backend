import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { KitchenInventoryItemStatus, UserRole } from '@prisma/client';
import { CreateKitchenItemDto } from '../dto/create-kitchen-item.dto';
import { UpdateKitchenItemDto } from '../dto/update-kitchen-item.dto';
import { KitchenItemQueryDto } from '../dto/kitchen-item-query.dto';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { KitchenAccessService } from './kitchen-access.service';

@Injectable()
export class KitchenItemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kitchenAccess: KitchenAccessService,
  ) {}

  /**
   * Derives status from stock percentage:
   * 0%       → MISSING
   * 1–25%    → LOW
   * 26–100%  → IN_STOCK
   */
  private deriveStatus(percent: number): KitchenInventoryItemStatus {
    if (percent === 0) return KitchenInventoryItemStatus.MISSING;
    if (percent <= 25) return KitchenInventoryItemStatus.LOW;
    return KitchenInventoryItemStatus.IN_STOCK;
  }

  /** Strip internal user-reference fields from the DB record */
  private formatItem(item: any) {
    const {
      userId,
      createdByUserId,
      lastUpdatedByUserId,
      createdByUser,
      ...rest
    } = item;

    return {
      ...rest,
      ownerStatus: createdByUser?.role ?? null,
    };
  }

  async create(userPayload: CurrentUserPayload, dto: CreateKitchenItemDto) {
    const isAdmin = userPayload.role === UserRole.ADMIN;
    const targetUserId = await this.kitchenAccess.resolveWritableParentUserId(
      userPayload,
      dto.userId,
      'manageGroceryLists',
    );
    const stockPercent = dto.currentStockPercent ?? 100;
    const status = this.deriveStatus(stockPercent);

    const item = await this.prisma.$transaction(async (tx) => {
      const kitchenItem = await tx.kitchenItem.create({
        data: {
          userId: targetUserId,
          createdByUserId: userPayload.userId,
          name: dto.name,
          unit: dto.unit,
          category: dto.category,
          currentStockPercent: stockPercent,
          status,
          notes: dto.notes,
          lastStockedAt: stockPercent > 0 ? new Date() : undefined,
        },
        include: {
          createdByUser: {
            select: { role: true },
          },
        },
      });

      if (!isAdmin) {
        await tx.shoppingListItem.create({
          data: {
            userId: targetUserId,
            createdByUserId: userPayload.userId,
            name: dto.name,
            unit: dto.unit ?? 'OTHER',
            quantity: '1',
            category: dto.category,
            note: dto.notes,
            addedToKitchen: true,
          },
        });
      }

      return kitchenItem;
    });

    return {
      message: 'Kitchen item created successfully',
      data: this.formatItem(item),
    };
  }

  async findAll(userPayload: CurrentUserPayload, query: KitchenItemQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const readableParentIds = await this.kitchenAccess.resolveReadableParentUserIds(
      userPayload,
      'manageGroceryLists',
    );
    const where: any = {
      ...(query.status && { status: query.status }),
      ...(query.ownerStatus && {
        createdByUser: { role: query.ownerStatus },
      }),
    };

    if (readableParentIds) {
      where.userId = { in: readableParentIds };
    }

    const [items, total] = await Promise.all([
      this.prisma.kitchenItem.findMany({
        where,
        include: {
          createdByUser: {
            select: { role: true },
          },
        },
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.kitchenItem.count({ where }),
    ]);

    return {
      message: 'Kitchen items fetched successfully',
      data: items.map(this.formatItem),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAdminStats(userPayload: CurrentUserPayload) {
    const readableParentIds = await this.kitchenAccess.resolveReadableParentUserIds(
      userPayload,
      'manageGroceryLists',
    );
    const where: any = {};

    if (readableParentIds) {
      where.userId = { in: readableParentIds };
    }

    const [totalItems, categoriesGroup, ownerGroups] = await Promise.all([
      this.prisma.kitchenItem.count({ where }),
      this.prisma.kitchenItem.groupBy({
        by: ['category'],
        where,
      }),
      this.prisma.kitchenItem.findMany({
        where,
        select: {
          createdByUser: {
            select: { role: true },
          },
        },
      }),
    ]);

    const ownerCounts = ownerGroups.reduce(
      (counts, item) => {
        const role = item.createdByUser.role;
        counts[role] = (counts[role] ?? 0) + 1;
        return counts;
      },
      {} as Record<string, number>,
    );

    return {
      message: 'Kitchen inventory stats fetched successfully',
      data: {
        totalItems,
        categories: categoriesGroup.length,
        ownerCounts,
      },
    };
  }

  async getSummary(userPayload: CurrentUserPayload) {
    const readableParentIds = await this.kitchenAccess.resolveReadableParentUserIds(
      userPayload,
      'manageGroceryLists',
    );
    const userWhere = readableParentIds ? { userId: { in: readableParentIds } } : {};
    const [total, missingCount, lowCount, stockCount, itemsToBuy] =
      await Promise.all([
        this.prisma.kitchenItem.count({ where: userWhere }),
        this.prisma.kitchenItem.count({
          where: { ...userWhere, status: KitchenInventoryItemStatus.MISSING },
        }),
        this.prisma.kitchenItem.count({
          where: { ...userWhere, status: KitchenInventoryItemStatus.LOW },
        }),
        this.prisma.kitchenItem.count({
          where: { ...userWhere, status: KitchenInventoryItemStatus.IN_STOCK },
        }),
        // itemsToBuy = actual count of shopping list items
        this.prisma.shoppingListItem.count({ where: userWhere }),
      ]);

    return {
      message: 'Kitchen summary fetched successfully',
      data: {
        total,
        missingCount,
        lowCount,
        stockCount,
        itemsToBuy,
      },
    };
  }

  async findOne(userPayload: CurrentUserPayload, id: string) {
    const item = await this.prisma.kitchenItem.findUnique({
      where: { id },
      include: {
        createdByUser: {
          select: { role: true },
        },
      },
    });

    if (!item) throw new NotFoundException('Kitchen item not found');
    if (!(await this.kitchenAccess.canAccessParentUser(userPayload, item.userId)))
      throw new ForbiddenException('You do not have access to this item');

    return {
      message: 'Kitchen item fetched successfully',
      data: this.formatItem(item),
    };
  }

  async update(userPayload: CurrentUserPayload, id: string, dto: UpdateKitchenItemDto) {
    const item = await this.prisma.kitchenItem.findUnique({ where: { id } });

    if (!item) throw new NotFoundException('Kitchen item not found');
    if (!(await this.kitchenAccess.canAccessParentUser(userPayload, item.userId)))
      throw new ForbiddenException('You do not have access to this item');

    const stockPercent =
      dto.currentStockPercent !== undefined
        ? dto.currentStockPercent
        : item.currentStockPercent;

    const status = this.deriveStatus(stockPercent);
    const updated = await this.prisma.kitchenItem.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.currentStockPercent !== undefined && {
          currentStockPercent: dto.currentStockPercent,
          // Update lastStockedAt only when stock is being increased
          ...(dto.currentStockPercent > item.currentStockPercent && {
            lastStockedAt: new Date(),
          }),
        }),
        status,
        lastUpdatedByUserId: userPayload.userId,
      },
      include: {
        createdByUser: {
          select: { role: true },
        },
      },
    });

    return {
      message: 'Kitchen item updated successfully',
      data: this.formatItem(updated),
    };
  }

  async remove(userPayload: CurrentUserPayload, id: string) {
    const item = await this.prisma.kitchenItem.findUnique({ where: { id } });

    if (!item) throw new NotFoundException('Kitchen item not found');
    if (!(await this.kitchenAccess.canAccessParentUser(userPayload, item.userId)))
      throw new ForbiddenException('You do not have access to this item');

    await this.prisma.kitchenItem.delete({ where: { id } });

    return { message: 'Kitchen item deleted successfully' };
  }
}
