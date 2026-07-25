import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { KitchenInventoryItemStatus } from '@prisma/client';
import { CreateKitchenItemDto } from '../dto/create-kitchen-item.dto';
import { UpdateKitchenItemDto } from '../dto/update-kitchen-item.dto';
import { KitchenItemQueryDto } from '../dto/kitchen-item-query.dto';

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

  async create(userId: string, dto: CreateKitchenItemDto) {
    const stockPercent = dto.currentStockPercent ?? 100;
    const status = this.deriveStatus(stockPercent);

    const item = await this.prisma.kitchenItem.create({
      data: {
        userId,
        createdByUserId: userId,
        name: dto.name,
        unit: dto.unit,
        category: dto.category,
        currentStockPercent: stockPercent,
        status,
        notes: dto.notes,
        lastStockedAt: stockPercent > 0 ? new Date() : undefined,
      },
    });

    return {
      message: 'Kitchen item created successfully',
      data: this.formatItem(item),
    };
  }

  async findAll(userId: string, query: KitchenItemQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(query.status && { status: query.status }),
    };

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

  async getSummary(userId: string) {
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

  async findOne(userId: string, id: string) {
    const item = await this.prisma.kitchenItem.findUnique({ where: { id } });

    if (!item) throw new NotFoundException('Kitchen item not found');
    if (item.userId !== userId)
      throw new ForbiddenException('You do not have access to this item');

    return {
      message: 'Kitchen item fetched successfully',
      data: this.formatItem(item),
    };
  }

  async update(userId: string, id: string, dto: UpdateKitchenItemDto) {
    const item = await this.prisma.kitchenItem.findUnique({ where: { id } });

    if (!item) throw new NotFoundException('Kitchen item not found');
    if (item.userId !== userId)
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
        lastUpdatedByUserId: userId,
      },
    });

    return {
      message: 'Kitchen item updated successfully',
      data: this.formatItem(updated),
    };
  }

  async remove(userId: string, id: string) {
    const item = await this.prisma.kitchenItem.findUnique({ where: { id } });

    if (!item) throw new NotFoundException('Kitchen item not found');
    if (item.userId !== userId)
      throw new ForbiddenException('You do not have access to this item');

    await this.prisma.kitchenItem.delete({ where: { id } });

    return { message: 'Kitchen item deleted successfully' };
  }
}
