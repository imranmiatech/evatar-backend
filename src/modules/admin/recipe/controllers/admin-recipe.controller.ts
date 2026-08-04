import { Controller, Post, Body, Patch, Param, Get, Query, Delete, UseGuards, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { AdminRecipeService } from '../services/admin-recipe.service';
import { CreateRecipeDto } from '../dto/create-recipe.dto';
import { UpdateRecipeDto } from '../dto/update-recipe.dto';
import { AdminRecipeQueryDto } from '../dto/recipe-query.dto';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('(Admin) > Recipe')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/recipes')
export class AdminRecipeController {
  constructor(private readonly adminRecipeService: AdminRecipeService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new Recipe' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'coverImage', maxCount: 1 },
      { name: 'video', maxCount: 1 },
    ]),
  )
  @ApiResponse({ status: 201, description: 'Recipe created successfully.' })
  async createRecipe(
    @Body() createRecipeDto: CreateRecipeDto,
    @UploadedFiles()
    files?: {
      coverImage?: Express.Multer.File[];
      video?: Express.Multer.File[];
    },
  ) {
    const recipe = await this.adminRecipeService.createRecipe(createRecipeDto, files);
    return {
      success: true,
      message: 'Recipe created successfully',
      data: recipe,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all Recipes (Paginated & Filtered)' })
  @ApiResponse({ status: 200, description: 'Recipes fetched successfully.' })
  async getAllRecipes(@Query() query: AdminRecipeQueryDto) {
    const result = await this.adminRecipeService.getAllRecipes(query);
    return {
      success: true,
      message: 'Recipes fetched successfully',
      data: result.data,
      meta: result.meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single Recipe by ID' })
  @ApiResponse({ status: 200, description: 'Recipe fetched successfully.' })
  async getRecipeById(@Param('id') id: string) {
    const recipe = await this.adminRecipeService.getRecipeById(id);
    return {
      success: true,
      message: 'Recipe fetched successfully',
      data: recipe,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing Recipe' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'coverImage', maxCount: 1 },
      { name: 'video', maxCount: 1 },
    ]),
  )
  @ApiResponse({ status: 200, description: 'Recipe updated successfully.' })
  async updateRecipe(
    @Param('id') id: string,
    @Body() updateRecipeDto: UpdateRecipeDto,
    @UploadedFiles()
    files?: {
      coverImage?: Express.Multer.File[];
      video?: Express.Multer.File[];
    },
  ) {
    const recipe = await this.adminRecipeService.updateRecipe(id, updateRecipeDto, files);
    return {
      success: true,
      message: 'Recipe updated successfully',
      data: recipe,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a Recipe' })
  @ApiResponse({ status: 200, description: 'Recipe deleted successfully.' })
  async deleteRecipe(@Param('id') id: string) {
    await this.adminRecipeService.deleteRecipe(id);
    return {
      success: true,
      message: 'Recipe deleted successfully',
      data: null,
    };
  }
}
