import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { KitchenInventoryItemStatus, KitchenItemAdminStatus, UserRole } from '@prisma/client';
import { CreateKitchenItemDto } from '../dto/create-kitchen-item.dto';
import { UpdateKitchenItemDto } from '../dto/update-kitchen-item.dto';
import { KitchenItemQueryDto } from '../dto/kitchen-item-query.dto';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';

@Injectable()
export class KitchenItemService {
  constructor(private readonly prisma: PrismaService) {}

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
    const { userId, createdByUserId, lastUpdatedByUserId, ...rest } = item;
    return rest;
  }

  async create(userPayload: CurrentUserPayload, dto: CreateKitchenItemDto) {
    const isAdmin = userPayload.role === UserRole.ADMIN;
    const targetUserId = (isAdmin && dto.userId) ? dto.userId : userPayload.userId;
    const stockPercent = dto.currentStockPercent ?? 100;
    const status = this.deriveStatus(stockPercent);

    const adminStatus = isAdmin
      ? (dto.adminStatus ?? KitchenItemAdminStatus.ACTIVE)
      : undefined;

    const item = await this.prisma.kitchenItem.create({
      data: {
        userId: targetUserId,
        createdByUserId: userPayload.userId,
        name: dto.name,
        unit: dto.unit,
        category: dto.category,
        currentStockPercent: stockPercent,
        status,
        ...(adminStatus && { adminStatus }),
        notes: dto.notes,
        lastStockedAt: stockPercent > 0 ? new Date() : undefined,
      },
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

    const isAdmin = userPayload.role === UserRole.ADMIN;
    const where: any = {
      ...(query.status && { status: query.status }),
      ...(query.adminStatus && { adminStatus: query.adminStatus }),
    };

    if (!isAdmin) {
      where.userId = userPayload.userId;
    }

    const [items, total] = await Promise.all([
      this.prisma.kitchenItem.findMany({
        where,
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
    const isAdmin = userPayload.role === UserRole.ADMIN;
    const where: any = {};

    if (!isAdmin) {
      where.userId = userPayload.userId;
    }

    const [totalItems, archived, categoriesGroup] = await Promise.all([
      this.prisma.kitchenItem.count({ where }),
      this.prisma.kitchenItem.count({
        where: {
          ...where,
          adminStatus: KitchenItemAdminStatus.ARCHIVE,
        },
      }),
      this.prisma.kitchenItem.groupBy({
        by: ['category'],
        where,
      }),
    ]);

    const active = totalItems - archived;

    return {
      message: 'Kitchen inventory stats fetched successfully',
      data: {
        totalItems,
        active,
        archived,
        categories: categoriesGroup.length,
      },
    };
  }

  async getSummary(userPayload: CurrentUserPayload) {
    const userId = userPayload.userId;
    const [total, missingCount, lowCount, stockCount, itemsToBuy] =
      await Promise.all([
        this.prisma.kitchenItem.count({ where: { userId } }),
        this.prisma.kitchenItem.count({
          where: { userId, status: KitchenInventoryItemStatus.MISSING },
        }),
        this.prisma.kitchenItem.count({
          where: { userId, status: KitchenInventoryItemStatus.LOW },
        }),
        this.prisma.kitchenItem.count({
          where: { userId, status: KitchenInventoryItemStatus.IN_STOCK },
        }),
        // itemsToBuy = actual count of shopping list items
        this.prisma.shoppingListItem.count({ where: { userId } }),
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
    const item = await this.prisma.kitchenItem.findUnique({ where: { id } });

    if (!item) throw new NotFoundException('Kitchen item not found');
    if (item.userId !== userPayload.userId && userPayload.role !== UserRole.ADMIN)
      throw new ForbiddenException('You do not have access to this item');

    return {
      message: 'Kitchen item fetched successfully',
      data: this.formatItem(item),
    };
  }

  async update(userPayload: CurrentUserPayload, id: string, dto: UpdateKitchenItemDto) {
    const item = await this.prisma.kitchenItem.findUnique({ where: { id } });

    if (!item) throw new NotFoundException('Kitchen item not found');
    if (item.userId !== userPayload.userId && userPayload.role !== UserRole.ADMIN)
      throw new ForbiddenException('You do not have access to this item');

    const stockPercent =
      dto.currentStockPercent !== undefined
        ? dto.currentStockPercent
        : item.currentStockPercent;

    const status = this.deriveStatus(stockPercent);
    const isAdmin = userPayload.role === UserRole.ADMIN;

    const updated = await this.prisma.kitchenItem.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(isAdmin && dto.adminStatus !== undefined && { adminStatus: dto.adminStatus }),
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
    });

    return {
      message: 'Kitchen item updated successfully',
      data: this.formatItem(updated),
    };
  }

  async remove(userPayload: CurrentUserPayload, id: string) {
    const item = await this.prisma.kitchenItem.findUnique({ where: { id } });

    if (!item) throw new NotFoundException('Kitchen item not found');
    if (item.userId !== userPayload.userId && userPayload.role !== UserRole.ADMIN)
      throw new ForbiddenException('You do not have access to this item');

    await this.prisma.kitchenItem.delete({ where: { id } });

    return { message: 'Kitchen item deleted successfully' };
  }

  async toggleAdminStatus(
    userPayload: CurrentUserPayload,
    id: string,
    targetStatus?: KitchenItemAdminStatus,
  ) {
    const item = await this.prisma.kitchenItem.findUnique({ where: { id } });

    if (!item) throw new NotFoundException('Kitchen item not found');
    if (item.userId !== userPayload.userId && userPayload.role !== UserRole.ADMIN)
      throw new ForbiddenException('You do not have access to this item');

    let nextStatus: KitchenItemAdminStatus;
    if (targetStatus) {
      nextStatus = targetStatus;
    } else {
      nextStatus =
        item.adminStatus === KitchenItemAdminStatus.ARCHIVE
          ? KitchenItemAdminStatus.ACTIVE
          : KitchenItemAdminStatus.ARCHIVE;
    }

    const updated = await this.prisma.kitchenItem.update({
      where: { id },
      data: {
        adminStatus: nextStatus,
        lastUpdatedByUserId: userPayload.userId,
      },
    });

    return {
      message: `Kitchen item admin status updated to ${nextStatus}`,
      data: this.formatItem(updated),
    };
  }
}

