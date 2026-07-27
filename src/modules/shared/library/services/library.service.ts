import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { LibraryQueryDto } from '../dto/library-query.dto';

@Injectable()
export class LibraryService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(query: LibraryQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const hasRecipeFilter = !!query.recipeMealType;
    const hasActivityFilter = !!query.activityType || !!query.location;

    const ageWhere = {
      ...(query.minAge !== undefined && {
        minAgeMonths: { lte: query.minAge },
      }),
      ...(query.maxAge !== undefined && {
        maxAgeMonths: { gte: query.maxAge },
      }),
    };

    const searchWhere = (search?: string) =>
      search
        ? { title: { contains: search, mode: 'insensitive' as const } }
        : {};

    const activityWhere = {
      isActive: true,
      ...(query.activityType && { activityType: query.activityType }),
      ...(query.location && { location: { has: query.location } }),
      ...searchWhere(query.search),
      ...ageWhere,
    };

    const recipeWhere = {
      isActive: true,
      ...(query.recipeMealType && { recipeMealType: query.recipeMealType }),
      ...searchWhere(query.search),
      ...ageWhere,
    };

    const skipActivities = hasRecipeFilter && !hasActivityFilter;
    const skipRecipes = hasActivityFilter && !hasRecipeFilter;

    const activitySelect = {
      id: true,
      title: true,
      imageUrl: true,
      activityType: true,
      minAgeMonths: true,
      maxAgeMonths: true,
      durationMin: true,
      durationMax: true,
      energyLevel: true,
      location: true,
      connectionMoment: true,
    };

    const recipeSelect = {
      id: true,
      title: true,
      imageUrl: true,
      recipeMealType: true,
      minAgeMonths: true,
      maxAgeMonths: true,
      prepTimeMin: true,
      cookTimeMin: true,
      difficulty: true,
      servings: true,
      nutritionalFocus: true,
    };

    const [activities, recipes, activityCount, recipeCount] = await Promise.all(
      [
        skipActivities
          ? Promise.resolve([] as any[])
          : this.prisma.activity.findMany({
              where: activityWhere,
              select: activitySelect,
              orderBy: { createdAt: 'desc' },
              skip,
              take: limit,
            }),

        skipRecipes
          ? Promise.resolve([] as any[])
          : this.prisma.recipe.findMany({
              where: recipeWhere,
              select: recipeSelect,
              orderBy: { createdAt: 'desc' },
              skip,
              take: limit,
            }),

        skipActivities
          ? Promise.resolve(0)
          : this.prisma.activity.count({ where: activityWhere }),

        skipRecipes
          ? Promise.resolve(0)
          : this.prisma.recipe.count({ where: recipeWhere }),
      ],
    );

    const mappedActivities = activities.map((a) => ({
      id: a.id,
      type: 'activity' as const,
      title: a.title,
      imageUrl: a.imageUrl,
      category: a.activityType,
      ageSuitability:
        a.minAgeMonths !== null && a.maxAgeMonths !== null
          ? `${this.formatAge(a.minAgeMonths)} - ${this.formatAge(a.maxAgeMonths)}`
          : null,
      duration:
        a.durationMin !== null && a.durationMax !== null
          ? `${a.durationMin}-${a.durationMax} min`
          : null,
      energyLevel: a.energyLevel,
      location: a.location,
      connectionMoment: a.connectionMoment,
    }));

    const mappedRecipes = recipes.map((r) => ({
      id: r.id,
      type: 'recipe' as const,
      title: r.title,
      imageUrl: r.imageUrl,
      category: r.recipeMealType,
      ageSuitability:
        r.minAgeMonths !== null && r.maxAgeMonths !== null
          ? `${this.formatAge(r.minAgeMonths)} - ${this.formatAge(r.maxAgeMonths)}`
          : null,
      prepTimeMin: r.prepTimeMin,
      cookTimeMin: r.cookTimeMin,
      difficulty: r.difficulty,
      servings: r.servings,
      nutritionalFocus: r.nutritionalFocus,
    }));

    return {
      message: 'Library items fetched successfully',
      data: {
        activities: mappedActivities,
        recipes: mappedRecipes,
      },
      meta: {
        activities: {
          total: activityCount,
          page,
          limit,
          totalPages: Math.ceil(activityCount / limit),
        },
        recipes: {
          total: recipeCount,
          page,
          limit,
          totalPages: Math.ceil(recipeCount / limit),
        },
      },
    };
  }

  async getActivities(query: LibraryQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const ageWhere = this.activityAgeWhere(query);
    const activityWhere = {
      isActive: true,
      ...(query.activityType && { activityType: query.activityType }),
      ...(query.location && { location: { has: query.location } }),
      ...this.searchWhere(query.search),
      ...ageWhere,
    };

    const [activities, activityCount] = await Promise.all([
      this.prisma.activity.findMany({
        where: activityWhere,
        select: this.activityCardSelect(),
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.activity.count({ where: activityWhere }),
    ]);

    return {
      message: 'Activities fetched successfully',
      data: {
        activities: activities.map((activity) =>
          this.formatActivityCard(activity),
        ),
      },
      meta: {
        activities: {
          total: activityCount,
          page,
          limit,
          totalPages: Math.ceil(activityCount / limit),
        },
      },
    };
  }

  async getActivityById(id: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id, isActive: true },
      select: {
        id: true,
        title: true,
        imageUrl: true,
        activityType: true,
        minAgeMonths: true,
        maxAgeMonths: true,
        durationMin: true,
        durationMax: true,
        energyLevel: true,
        location: true,
        connectionMoment: true,
        whyThisActivity: true,
        caregiverPrompts: true,
        benefits: {
          select: { id: true, title: true, description: true, iconUrl: true },
        },
        steps: {
          select: { id: true, stepNumber: true, description: true },
          orderBy: { stepNumber: 'asc' },
        },
        progressions: {
          select: { id: true, level: true, description: true },
          orderBy: { level: 'asc' },
        },
      },
    });

    if (!activity) return null;

    return {
      id: activity.id,
      type: 'activity' as const,
      title: activity.title,
      imageUrl: activity.imageUrl,
      category: activity.activityType,
      ageSuitability:
        activity.minAgeMonths !== null && activity.maxAgeMonths !== null
          ? `${activity.minAgeMonths}-${activity.maxAgeMonths}m`
          : null,
      duration:
        activity.durationMin !== null && activity.durationMax !== null
          ? `${activity.durationMin}-${activity.durationMax} min`
          : null,
      energyLevel: activity.energyLevel,
      location: activity.location,
      connectionMoment: activity.connectionMoment,
      whyThisActivity: activity.whyThisActivity,
      caregiverPrompts: activity.caregiverPrompts,
      developmentalBenefits: activity.benefits,
      howToDoIt: activity.steps,
      progressionLevels: activity.progressions,
    };
  }

  async getRecipeById(id: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id, isActive: true },
      select: {
        id: true,
        title: true,
        imageUrl: true,
        recipeMealType: true,
        minAgeMonths: true,
        maxAgeMonths: true,
        prepTimeMin: true,
        cookTimeMin: true,
        difficulty: true,
        servings: true,
        nutritionalFocus: true,
        safetyNotes: true,
        ingredients: {
          select: {
            id: true,
            name: true,
            amount: true,
            substitute: true,
            isOptional: true,
          },
        },
        steps: {
          select: { id: true, stepNumber: true, description: true },
          orderBy: { stepNumber: 'asc' },
        },
      },
    });

    if (!recipe) return null;

    const required = recipe.ingredients.filter((i) => !i.isOptional);
    const optional = recipe.ingredients.filter((i) => i.isOptional);

    return {
      id: recipe.id,
      type: 'recipe' as const,
      title: recipe.title,
      imageUrl: recipe.imageUrl,
      category: recipe.recipeMealType,
      ageSuitability:
        recipe.minAgeMonths !== null && recipe.maxAgeMonths !== null
          ? `${recipe.minAgeMonths}-${recipe.maxAgeMonths}m`
          : null,
      prepTimeMin: recipe.prepTimeMin,
      cookTimeMin: recipe.cookTimeMin,
      difficulty: recipe.difficulty,
      servings: recipe.servings,
      nutritionalFocus: recipe.nutritionalFocus,
      ingredients: { required, optional },
      stepByStepInstructions: recipe.steps,
      safetyNotes: recipe.safetyNotes,
    };
  }

  private formatAge(months: number): string {
    if (months < 12) {
      return `${months} month${months !== 1 ? 's' : ''}`;
    }
    const years = months / 12;
    const rounded = Math.round(years * 2) / 2;
    return `${rounded} year${rounded !== 1 ? 's' : ''}`;
  }

  private activityAgeWhere(query: LibraryQueryDto) {
    return {
      ...(query.minAge !== undefined && {
        minAgeMonths: { lte: query.minAge },
      }),
      ...(query.maxAge !== undefined && {
        maxAgeMonths: { gte: query.maxAge },
      }),
    };
  }

  private searchWhere(search?: string) {
    return search
      ? { title: { contains: search, mode: 'insensitive' as const } }
      : {};
  }

  private activityCardSelect() {
    return {
      id: true,
      title: true,
      imageUrl: true,
      activityType: true,
      minAgeMonths: true,
      maxAgeMonths: true,
      durationMin: true,
      durationMax: true,
      energyLevel: true,
      location: true,
      connectionMoment: true,
    };
  }

  private formatActivityCard(activity: {
    id: string;
    title: string;
    imageUrl: string | null;
    activityType: unknown;
    minAgeMonths: number | null;
    maxAgeMonths: number | null;
    durationMin: number | null;
    durationMax: number | null;
    energyLevel: unknown;
    location: unknown;
    connectionMoment: string | null;
  }) {
    return {
      id: activity.id,
      type: 'activity' as const,
      title: activity.title,
      imageUrl: activity.imageUrl,
      category: activity.activityType,
      ageSuitability:
        activity.minAgeMonths !== null && activity.maxAgeMonths !== null
          ? `${this.formatAge(activity.minAgeMonths)} - ${this.formatAge(activity.maxAgeMonths)}`
          : null,
      duration:
        activity.durationMin !== null && activity.durationMax !== null
          ? `${activity.durationMin}-${activity.durationMax} min`
          : null,
      energyLevel: activity.energyLevel,
      location: activity.location,
      connectionMoment: activity.connectionMoment,
    };
  }
}
