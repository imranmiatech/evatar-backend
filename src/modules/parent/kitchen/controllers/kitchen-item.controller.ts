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
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { KitchenItemService } from '../services/kitchen-item.service';
import { CreateKitchenItemDto } from '../dto/create-kitchen-item.dto';
import { UpdateKitchenItemDto } from '../dto/update-kitchen-item.dto';
import { KitchenItemQueryDto } from '../dto/kitchen-item-query.dto';

@ApiTags('(Parent) > Kitchen > Inventory Manage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PARENT, UserRole.ADMIN, UserRole.NANNY)
@Controller('parent/kitchen/items')
export class KitchenItemController {
  constructor(private readonly kitchenItemService: KitchenItemService) {}

  @Post()
  @ApiOperation({
    summary: 'Add a new kitchen inventory item',
    description:
      'Creates a new item in the kitchen inventory. Admin-created items appear in suggestions; parent/nanny-created items are mirrored to the shopping list. Stock status is automatically derived from currentStockPercent (0%→MISSING, 1–25%→LOW, 26–100%→IN_STOCK).',
  })
  @ApiResponse({ status: 201, description: 'Item created successfully.' })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateKitchenItemDto,
  ) {
    return this.kitchenItemService.create(user, dto);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get kitchen inventory summary',
    description:
      'Returns total item counts grouped by status (Missing, Low, In Stock). itemsToBuy reflects the actual shopping list count.',
  })
  @ApiResponse({ status: 200, description: 'Summary returned.' })
  getSummary(@CurrentUser() user: CurrentUserPayload) {
    return this.kitchenItemService.getSummary(user);
  }

  @Get('stats')
  @ApiOperation({
    summary:
      'Get kitchen inventory stats (Total Items, Categories, Owner Counts)',
    description:
      'Returns total item count, category count, and creator role counts.',
  })
  @ApiResponse({ status: 200, description: 'Stats returned.' })
  getStats(@CurrentUser() user: CurrentUserPayload) {
    return this.kitchenItemService.getAdminStats(user);
  }

  @Get('admin-stats')
  @ApiOperation({
    summary:
      'Get kitchen inventory admin stats (Total Items, Categories, Owner Counts)',
    description:
      'Returns summary metrics: totalItems, categories count, and creator role counts.',
  })
  @ApiResponse({ status: 200, description: 'Admin stats returned.' })
  getAdminStats(@CurrentUser() user: CurrentUserPayload) {
    return this.kitchenItemService.getAdminStats(user);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all kitchen inventory items',
    description:
      'Returns paginated kitchen items. Supports search, category, tab (ALL/ACTIVE/ARCHIVED), stock status, owner status, page, and limit.',
  })
  @ApiQuery({ name: 'search', required: false, example: 'Almond' })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: [
      'PRODUCE',
      'DAIRY',
      'BAKERY',
      'PANTRY',
      'BABY',
      'FRUIT',
      'MEAT',
      'OTHER',
    ],
  })
  @ApiQuery({
    name: 'tab',
    required: false,
    enum: ['ALL', 'ACTIVE', 'ARCHIVED'],
    example: 'ALL',
  })
  @ApiResponse({ status: 200, description: 'Items returned.' })
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: KitchenItemQueryDto,
  ) {
    return this.kitchenItemService.findAll(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single kitchen item by ID' })
  @ApiParam({ name: 'id', description: 'Kitchen Item ID' })
  @ApiResponse({ status: 200, description: 'Item returned.' })
  @ApiResponse({ status: 404, description: 'Item not found.' })
  findOne(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.kitchenItemService.findOne(user, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a kitchen item',
    description:
      'Updates any fields including currentStockPercent. Status is auto-derived from stock percentage. lastStockedAt updates automatically when stock increases.',
  })
  @ApiParam({ name: 'id', description: 'Kitchen Item ID' })
  @ApiResponse({ status: 200, description: 'Item updated.' })
  @ApiResponse({ status: 404, description: 'Item not found.' })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateKitchenItemDto,
  ) {
    return this.kitchenItemService.update(user, id, dto);
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Archive a kitchen item' })
  @ApiParam({ name: 'id', description: 'Kitchen Item ID' })
  @ApiResponse({ status: 200, description: 'Item archived.' })
  archive(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.kitchenItemService.archive(user, id);
  }

  @Patch(':id/restore')
  @ApiOperation({ summary: 'Restore an archived kitchen item' })
  @ApiParam({ name: 'id', description: 'Kitchen Item ID' })
  @ApiResponse({ status: 200, description: 'Item restored.' })
  restore(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.kitchenItemService.restore(user, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a kitchen item' })
  @ApiParam({ name: 'id', description: 'Kitchen Item ID' })
  @ApiResponse({ status: 200, description: 'Item deleted.' })
  @ApiResponse({ status: 404, description: 'Item not found.' })
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.kitchenItemService.remove(user, id);
  }
}
