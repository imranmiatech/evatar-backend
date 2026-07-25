import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { ShoppingListService } from '../services/shopping-list.service';
import { CreateShoppingItemDto } from '../dto/create-shopping-item.dto';
import { UpdateShoppingItemDto } from '../dto/update-shopping-item.dto';
import { PaginationQueryDto } from '../dto/pagination-query.dto';

@ApiTags('Parent > Kitchen > Shopping List')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PARENT)
@Controller('parent/kitchen/shopping')
export class ShoppingListController {
  constructor(private readonly shoppingListService: ShoppingListService) { }

  @Post()
  @ApiOperation({
    summary: 'Add an item to the shopping list',
    description: 'Adds a new item that needs to be purchased.',
  })
  @ApiResponse({ status: 201, description: 'Item added to shopping list.' })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateShoppingItemDto,
  ) {
    return this.shoppingListService.create(user.userId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all shopping list items',
    description: 'Returns paginated shopping list items, grouped by category. Supports page & limit query params.',
  })
  @ApiResponse({ status: 200, description: 'Shopping list returned.' })
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: PaginationQueryDto,
  ) {
    return this.shoppingListService.findAll(user.userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single shopping list item by ID' })
  @ApiParam({ name: 'id', description: 'Shopping Item ID' })
  @ApiResponse({ status: 200, description: 'Item returned.' })
  @ApiResponse({ status: 404, description: 'Item not found.' })
  findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.shoppingListService.findOne(user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a shopping list item' })
  @ApiParam({ name: 'id', description: 'Shopping Item ID' })
  @ApiResponse({ status: 200, description: 'Item updated.' })
  @ApiResponse({ status: 404, description: 'Item not found.' })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateShoppingItemDto,
  ) {
    return this.shoppingListService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a shopping list item' })
  @ApiParam({ name: 'id', description: 'Shopping Item ID' })
  @ApiResponse({ status: 200, description: 'Item deleted.' })
  @ApiResponse({ status: 404, description: 'Item not found.' })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.shoppingListService.remove(user.userId, id);
  }
}
