import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { KitchenAccessService } from './kitchen-access.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class KitchenSuggestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kitchenAccess: KitchenAccessService,
  ) {}

  /**
   * Returns recipes whose title does NOT match any of the user's kitchen
   * item names (case-insensitive). These are the items the user may need
   * to stock in their kitchen based on available recipes.
   */
  async getSuggestedItems(user: CurrentUserPayload, query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const parentUserId = await this.kitchenAccess.resolveWritableParentUserId(
      user,
      undefined,
      'viewGroceryLists',
    );

    // 1. Fetch all kitchen item names for this user (lowercased for comparison)
    const kitchenItems = await this.prisma.kitchenItem.findMany({
      where: { userId: parentUserId },
      select: { name: true },
    });

    const kitchenNames = new Set(
      kitchenItems.map((item) => item.name.toLowerCase().trim()),
    );

    // 2. Fetch all active recipes and admin-created active grocery items
    const [allRecipes, adminItems] = await Promise.all([
      this.prisma.recipe.findMany({
        where: { isActive: true },
        select: { id: true, title: true },
        orderBy: { title: 'asc' },
      }),
      this.prisma.kitchenItem.findMany({
        where: {
          createdByUser: { role: UserRole.ADMIN },
        },
        select: {
          id: true,
          name: true,
          unit: true,
          category: true,
          currentStockPercent: true,
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    // 3. Filter suggestions whose names are NOT in the user's kitchen items
    const suggestions = [
      ...adminItems.map((item) => ({
        id: item.id,
        name: item.name,
        unit: item.unit,
        category: item.category,
        currentStockPercent: item.currentStockPercent,
        source: 'ADMIN_ITEM',
      })),
      ...allRecipes.map((recipe) => ({
        id: recipe.id,
        name: recipe.title,
        source: 'RECIPE',
      })),
    ].filter((item) => !kitchenNames.has(item.name.toLowerCase().trim()));

    const uniqueSuggestions = Array.from(
      new Map(
        suggestions.map((item) => [item.name.toLowerCase().trim(), item]),
      ).values(),
    );

    // 4. Paginate in-memory (suggestions are typically a manageable set)
    const total = uniqueSuggestions.length;
    const paginated = uniqueSuggestions.slice(skip, skip + limit);

    return {
      message: 'Suggested grocery items fetched successfully',
      data: paginated,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
