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

@ApiTags('Shared > Library')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('library')
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all activities and recipes',
    description:
      'Returns paginated list of activities and recipes. Filter by activityType, recipeMealType, or search by title.',
  })
  @ApiResponse({ status: 200, description: 'Library items returned successfully.' })
  async getAll(@Query() query: LibraryQueryDto) {
    const result = await this.libraryService.getAll(query);
    return {
      success: true,
      message: 'Library items fetched successfully',
      ...result,
    };
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
