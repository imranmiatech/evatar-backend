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
import { KitchenItemService } from '../services/kitchen-item.service';
import { CreateKitchenItemDto } from '../dto/create-kitchen-item.dto';
import { UpdateKitchenItemDto, UpdateAdminStatusDto } from '../dto/update-kitchen-item.dto';
import { KitchenItemQueryDto } from '../dto/kitchen-item-query.dto';

@ApiTags('(Parent) > Kitchen > Inventory Manage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PARENT, UserRole.ADMIN)
@Controller('parent/kitchen/items')
export class KitchenItemController {
  constructor(private readonly kitchenItemService: KitchenItemService) { }

  @Post()
  @ApiOperation({
    summary: 'Add a new kitchen inventory item',
    description:
      'Creates a new item in the kitchen inventory. When created by admin, adminStatus can be set (ACTIVE or ARCHIVE). Stock status is automatically derived from currentStockPercent (0%→MISSING, 1–25%→LOW, 26–100%→IN_STOCK).',
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
    summary: 'Get kitchen inventory stats (Total Items, Active, Archived, Categories)',
    description:
      'Returns total item count, active count, archived count, and category count for inventory summary cards.',
  })
  @ApiResponse({ status: 200, description: 'Stats returned.' })
  getStats(@CurrentUser() user: CurrentUserPayload) {
    return this.kitchenItemService.getAdminStats(user);
  }

  @Get('admin-stats')
  @ApiOperation({
    summary: 'Get kitchen inventory admin stats (Total Items, Active, Archived, Categories)',
    description:
      'Returns summary metrics: totalItems, active, archived, categories count.',
  })
  @ApiResponse({ status: 200, description: 'Admin stats returned.' })
  getAdminStats(@CurrentUser() user: CurrentUserPayload) {
    return this.kitchenItemService.getAdminStats(user);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all kitchen inventory items',
    description:
      'Returns paginated kitchen items. Optionally filter by status (MISSING, LOW, IN_STOCK). Supports page & limit query params.',
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
  findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.kitchenItemService.findOne(user, id);
  }

  @Patch(':id/admin-status')
  @ApiOperation({
    summary: 'Update or toggle adminStatus of a kitchen item (ACTIVE <-> ARCHIVE)',
    description:
      'Sets adminStatus to ACTIVE or ARCHIVE if provided in body. If body is empty, toggles between ACTIVE and ARCHIVE.',
  })
  @ApiParam({ name: 'id', description: 'Kitchen Item ID' })
  @ApiResponse({ status: 200, description: 'Admin status updated.' })
  @ApiResponse({ status: 404, description: 'Item not found.' })
  updateAdminStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto?: UpdateAdminStatusDto,
  ) {
    return this.kitchenItemService.toggleAdminStatus(user, id, dto?.adminStatus);
  }

  @Patch(':id/toggle-archive')
  @ApiOperation({
    summary: 'Toggle archive status of a kitchen item (ACTIVE <-> ARCHIVE)',
    description:
      'Toggles between ACTIVE and ARCHIVE status when clicking the archive icon.',
  })
  @ApiParam({ name: 'id', description: 'Kitchen Item ID' })
  @ApiResponse({ status: 200, description: 'Archive status toggled.' })
  @ApiResponse({ status: 404, description: 'Item not found.' })
  toggleArchive(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.kitchenItemService.toggleAdminStatus(user, id);
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

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a kitchen item' })
  @ApiParam({ name: 'id', description: 'Kitchen Item ID' })
  @ApiResponse({ status: 200, description: 'Item deleted.' })
  @ApiResponse({ status: 404, description: 'Item not found.' })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.kitchenItemService.remove(user, id);
  }
}
