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
import { UpdateKitchenItemDto } from '../dto/update-kitchen-item.dto';
import { KitchenItemQueryDto } from '../dto/kitchen-item-query.dto';

@ApiTags('Parent > Kitchen > Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PARENT)
@Controller('parent/kitchen/items')
export class KitchenItemController {
  constructor(private readonly kitchenItemService: KitchenItemService) {}

  @Post()
  @ApiOperation({
    summary: 'Add a new kitchen inventory item',
    description:
      'Creates a new item in the kitchen inventory. Stock status is automatically derived from currentStockPercent (0%→MISSING, 1–25%→LOW, 26–100%→IN_STOCK).',
  })
  @ApiResponse({ status: 201, description: 'Item created successfully.' })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateKitchenItemDto,
  ) {
    return this.kitchenItemService.create(user.userId, dto);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get kitchen inventory summary',
    description:
      'Returns total item counts grouped by status (Missing, Low, In Stock). itemsToBuy reflects the actual shopping list count.',
  })
  @ApiResponse({ status: 200, description: 'Summary returned.' })
  getSummary(@CurrentUser() user: CurrentUserPayload) {
    return this.kitchenItemService.getSummary(user.userId);
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
    return this.kitchenItemService.findAll(user.userId, query);
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
    return this.kitchenItemService.findOne(user.userId, id);
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
    return this.kitchenItemService.update(user.userId, id, dto);
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
    return this.kitchenItemService.remove(user.userId, id);
  }
}
