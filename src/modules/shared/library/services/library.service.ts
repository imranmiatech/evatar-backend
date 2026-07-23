import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { LibraryQueryDto } from '../dto/library-query.dto';

@Injectable()
export class LibraryService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(query: LibraryQueryDto) {
    const { search, activityType, recipeMealType, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [activities, recipes, activityCount, recipeCount] =
      await this.prisma.$transaction([
        this.prisma.activity.findMany({
          where: {
            isActive: true,
            ...(activityType && { activityType }),
            ...(search && {
              title: { contains: search, mode: 'insensitive' },
            }),
            ...(!recipeMealType && !search && {}),
          },
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
            benefits: {
              select: { title: true, description: true, iconUrl: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),

        this.prisma.recipe.findMany({
          where: {
            isActive: true,
            ...(recipeMealType && { recipeMealType }),
            ...(search && {
              title: { contains: search, mode: 'insensitive' },
            }),
            ...(!activityType && !search && {}),
          },
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
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),

        this.prisma.activity.count({
          where: {
            isActive: true,
            ...(activityType && { activityType }),
            ...(search && {
              title: { contains: search, mode: 'insensitive' },
            }),
          },
        }),

        this.prisma.recipe.count({
          where: {
            isActive: true,
            ...(recipeMealType && { recipeMealType }),
            ...(search && {
              title: { contains: search, mode: 'insensitive' },
            }),
          },
        }),
      ]);

    const mappedActivities = activities.map((a) => ({
      id: a.id,
      type: 'activity' as const,
      title: a.title,
      imageUrl: a.imageUrl,
      category: a.activityType,
      ageSuitability:
        a.minAgeMonths !== null && a.maxAgeMonths !== null
          ? `${a.minAgeMonths}-${a.maxAgeMonths}m`
          : null,
      duration:
        a.durationMin !== null && a.durationMax !== null
          ? `${a.durationMin}-${a.durationMax} min`
          : null,
      energyLevel: a.energyLevel,
      location: a.location,
      connectionMoment: a.connectionMoment,
      developmentalBenefits: a.benefits,
    }));

    const mappedRecipes = recipes.map((r) => ({
      id: r.id,
      type: 'recipe' as const,
      title: r.title,
      imageUrl: r.imageUrl,
      category: r.recipeMealType,
      ageSuitability:
        r.minAgeMonths !== null && r.maxAgeMonths !== null
          ? `${r.minAgeMonths}-${r.maxAgeMonths}m`
          : null,
      prepTimeMin: r.prepTimeMin,
      cookTimeMin: r.cookTimeMin,
      difficulty: r.difficulty,
      servings: r.servings,
      nutritionalFocus: r.nutritionalFocus,
    }));

    return {
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
}
