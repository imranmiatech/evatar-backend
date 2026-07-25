import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { KitchenSuggestionService } from '../services/kitchen-suggestion.service';
import { PaginationQueryDto } from '../dto/pagination-query.dto';

@ApiTags('(Parent) > Kitchen > Suggestions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PARENT)
@Controller('parent/kitchen/suggestions')
export class KitchenSuggestionController {
  constructor(
    private readonly kitchenSuggestionService: KitchenSuggestionService,
  ) { }

  @Get()
  @ApiOperation({
    summary: 'Get suggested grocery items from recipes',
    description:
      "Compares all active recipe titles with the user's kitchen inventory item names. Returns recipes that are NOT already in the kitchen — i.e., items the user may want to add. Returns only id and name. Supports page & limit query params.",
  })
  @ApiResponse({
    status: 200,
    description: 'Suggested items returned.',
    schema: {
      example: {
        message: 'Suggested grocery items fetched successfully',
        data: [
          { id: 'uuid-1', name: 'Organic Whole Milk' },
          { id: 'uuid-2', name: 'Carrot Soup' },
        ],
        meta: { total: 12, page: 1, limit: 20, totalPages: 1 },
      },
    },
  })
  getSuggestedItems(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: PaginationQueryDto,
  ) {
    return this.kitchenSuggestionService.getSuggestedItems(user.userId, query);
  }
}
