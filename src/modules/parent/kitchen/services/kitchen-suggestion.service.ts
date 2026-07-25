import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { PaginationQueryDto } from '../dto/pagination-query.dto';

@Injectable()
export class KitchenSuggestionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns recipes whose title does NOT match any of the user's kitchen
   * item names (case-insensitive). These are the items the user may need
   * to stock in their kitchen based on available recipes.
   */
  async getSuggestedItems(userId: string, query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    // 1. Fetch all kitchen item names for this user (lowercased for comparison)
    const kitchenItems = await this.prisma.kitchenItem.findMany({
      where: { userId },
      select: { name: true },
    });

    const kitchenNames = new Set(
      kitchenItems.map((item) => item.name.toLowerCase().trim()),
    );

    // 2. Fetch all active recipes
    const allRecipes = await this.prisma.recipe.findMany({
      where: { isActive: true },
      select: { id: true, title: true },
      orderBy: { title: 'asc' },
    });

    // 3. Filter recipes whose title is NOT in the kitchen item names
    const unmatched = allRecipes.filter(
      (recipe) => !kitchenNames.has(recipe.title.toLowerCase().trim()),
    );

    // 4. Paginate in-memory (recipes are typically a manageable set)
    const total = unmatched.length;
    const paginated = unmatched.slice(skip, skip + limit);

    return {
      message: 'Suggested grocery items fetched successfully',
      data: paginated.map((r) => ({ id: r.id, name: r.title })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
