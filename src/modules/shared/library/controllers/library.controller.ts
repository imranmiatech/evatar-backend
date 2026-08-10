import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { LibraryService } from '../services/library.service';
import { LibraryQueryDto } from '../dto/library-query.dto';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';

@ApiTags('(Shared) > Library')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PARENT, UserRole.NANNY)
@Controller('library')
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all activities and recipes',
    description:
      'Returns paginated list of activities and recipes. Filter by activityType, recipeMealType, or search by title.',
  })
  @ApiResponse({
    status: 200,
    description: 'Library items returned successfully.',
  })
  async getAll(@Query() query: LibraryQueryDto) {
    return this.libraryService.getAll(query);
  }

  @Get('activities')
  @ApiOperation({
    summary: 'Get all activities',
    description:
      'Returns paginated list of activities only. Filter by activityType, location, age range, or search by title.',
  })
  @ApiResponse({
    status: 200,
    description: 'Activities returned successfully.',
  })
  async getActivities(@Query() query: LibraryQueryDto) {
    return this.libraryService.getActivities(query);
  }

  @Get('recipes')
  @ApiOperation({
    summary: 'Get all recipes',
    description:
      'Returns paginated list of recipes only. Filter by recipeMealType, age range, or search by title.',
  })
  @ApiResponse({
    status: 200,
    description: 'Recipes returned successfully.',
  })
  async getRecipes(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: LibraryQueryDto,
  ) {
    return this.libraryService.getRecipes(user, query);
  }

  @Get('recipes/suggestions')
  @ApiOperation({
    summary: 'Get age-based suggested recipe names',
    description:
      'Returns recipe name suggestions based on age range. Supports minAge, maxAge, search, page, and limit query params.',
  })
  @ApiResponse({
    status: 200,
    description: 'Recipe suggestions returned successfully.',
  })
  async getRecipeSuggestions(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: LibraryQueryDto,
  ) {
    return this.libraryService.getRecipeSuggestions(user, query);
  }

  @Get('activities/:id')
  @ApiOperation({ summary: 'Get a single activity by ID' })
  @ApiParam({ name: 'id', description: 'Activity UUID' })
  @ApiResponse({ status: 200, description: 'Activity returned successfully.' })
  @ApiResponse({ status: 404, description: 'Activity not found.' })
  async getActivity(@Param('id') id: string) {
    const activity = await this.libraryService.getActivityById(id);
    if (!activity) throw new NotFoundException('Activity not found');
    return {
      success: true,
      message: 'Activity fetched successfully',
      data: activity,
    };
  }

  @Get('recipes/:id')
  @ApiOperation({ summary: 'Get a single recipe by ID' })
  @ApiParam({ name: 'id', description: 'Recipe UUID' })
  @ApiResponse({ status: 200, description: 'Recipe returned successfully.' })
  @ApiResponse({ status: 404, description: 'Recipe not found.' })
  async getRecipe(@Param('id') id: string) {
    const recipe = await this.libraryService.getRecipeById(id);
    if (!recipe) throw new NotFoundException('Recipe not found');
    return {
      success: true,
      message: 'Recipe fetched successfully',
      data: recipe,
    };
  }
}
