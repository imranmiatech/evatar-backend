import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CreateShoppingItemDto } from '../dto/create-shopping-item.dto';
import { UpdateShoppingItemDto } from '../dto/update-shopping-item.dto';
import { PaginationQueryDto } from '../dto/pagination-query.dto';

@Injectable()
export class ShoppingListService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateShoppingItemDto) {
    const item = await this.prisma.shoppingListItem.create({
      data: {
        userId,
        name: dto.name,
        unit: dto.unit,
        quantity: dto.quantity,
        category: dto.category,
        note: dto.note,
      },
    });

    return {
      message: 'Shopping item added successfully',
      data: item,
    };
  }

  async findAll(userId: string, query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = { userId };

    const [items, total] = await Promise.all([
      this.prisma.shoppingListItem.findMany({
        where,
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.shoppingListItem.count({ where }),
    ]);

    return {
      message: 'Shopping list fetched successfully',
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(userId: string, id: string) {
    const item = await this.prisma.shoppingListItem.findUnique({ where: { id } });

    if (!item) throw new NotFoundException('Shopping item not found');
    if (item.userId !== userId)
      throw new ForbiddenException('You do not have access to this item');

    return {
      message: 'Shopping item fetched successfully',
      data: item,
    };
  }

  async update(userId: string, id: string, dto: UpdateShoppingItemDto) {
    const item = await this.prisma.shoppingListItem.findUnique({ where: { id } });

    if (!item) throw new NotFoundException('Shopping item not found');
    if (item.userId !== userId)
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
    });

    return {
      message: 'Shopping item updated successfully',
      data: updated,
    };
  }

  async remove(userId: string, id: string) {
    const item = await this.prisma.shoppingListItem.findUnique({ where: { id } });

    if (!item) throw new NotFoundException('Shopping item not found');
    if (item.userId !== userId)
      throw new ForbiddenException('You do not have access to this item');

    await this.prisma.shoppingListItem.delete({ where: { id } });

    return { message: 'Shopping item deleted successfully' };
  }
}
