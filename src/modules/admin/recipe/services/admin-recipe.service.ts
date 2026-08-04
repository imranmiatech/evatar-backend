import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CreateRecipeDto } from '../dto/create-recipe.dto';
import { UpdateRecipeDto } from '../dto/update-recipe.dto';
import { AdminRecipeQueryDto } from '../dto/recipe-query.dto';
import { StorageService } from '../../../../common/storage/storage.service';

@Injectable()
export class AdminRecipeService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
  ) {}

  async createRecipe(
    dto: CreateRecipeDto,
    files?: { coverImage?: Express.Multer.File[]; video?: Express.Multer.File[] },
  ) {
    const { ingredients, steps, coverImage, video, ...recipeData } = dto;
    
    let imageUrl: string | undefined = undefined;
    let videoUrl: string | undefined = undefined;

    if (files?.coverImage?.[0]) {
      imageUrl = await this.storageService.uploadFile(files.coverImage[0], 'recipes/covers');
    }
    if (files?.video?.[0]) {
      videoUrl = await this.storageService.uploadFile(files.video[0], 'recipes/videos');
    }

    return this.prisma.recipe.create({
      data: {
        ...recipeData,
        isActive: recipeData.status === 'PUBLISHED',
        imageUrl,
        videoUrl,
        ingredients: {
          create: ingredients,
        },
        steps: {
          create: steps,
        },
      },
      include: { ingredients: true, steps: true },
    });
  }

  async updateRecipe(
    id: string,
    dto: UpdateRecipeDto,
    files?: { coverImage?: Express.Multer.File[]; video?: Express.Multer.File[] },
  ) {
    const recipe = await this.prisma.recipe.findUnique({ where: { id } });
    if (!recipe) throw new NotFoundException('Recipe not found');

    const { ingredients, steps, coverImage, video, ...recipeData } = dto;

    let imageUrl: string | undefined = undefined;
    let videoUrl: string | undefined = undefined;

    if (files?.coverImage?.[0]) {
      imageUrl = await this.storageService.uploadFile(files.coverImage[0], 'recipes/covers');
    }
    if (files?.video?.[0]) {
      videoUrl = await this.storageService.uploadFile(files.video[0], 'recipes/videos');
    }

    return this.prisma.recipe.update({
      where: { id },
      data: {
        ...recipeData,
        ...(recipeData.status && { isActive: recipeData.status === 'PUBLISHED' }),
        ...(imageUrl && { imageUrl }),
        ...(videoUrl && { videoUrl }),
        ...(ingredients && {
          ingredients: {
            deleteMany: {},
            create: ingredients,
          },
        }),
        ...(steps && {
          steps: {
            deleteMany: {},
            create: steps,
          },
        }),
      },
      include: { ingredients: true, steps: true },
    });
  }

  async getAllRecipes(query: AdminRecipeQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const ageWhere = {
      ...(query.minAge !== undefined && { minAgeMonths: { lte: query.minAge } }),
      ...(query.maxAge !== undefined && { maxAgeMonths: { gte: query.maxAge } }),
    };

    const where = {
      ...(query.search && { title: { contains: query.search, mode: 'insensitive' as const } }),
      ...(query.recipeMealType && { recipeMealType: query.recipeMealType }),
      ...(query.status && { status: query.status }),
      ...ageWhere,
    };

    const [recipes, total] = await Promise.all([
      this.prisma.recipe.findMany({
        where,
        include: {
          ingredients: true,
          steps: { orderBy: { stepNumber: 'asc' } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.recipe.count({ where }),
    ]);

    return {
      data: recipes,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getRecipeById(id: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id },
      include: {
        ingredients: true,
        steps: { orderBy: { stepNumber: 'asc' } },
      },
    });

    if (!recipe) throw new NotFoundException('Recipe not found');
    return recipe;
  }

  async deleteRecipe(id: string) {
    const recipe = await this.prisma.recipe.findUnique({ where: { id } });
    if (!recipe) throw new NotFoundException('Recipe not found');

    await this.prisma.recipe.delete({ where: { id } });
    return { id };
  }
}
