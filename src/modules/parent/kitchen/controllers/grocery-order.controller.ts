import {
  Body,
  Controller,
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
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../../../common/decorators/current-user.decorator';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import {
  CreateGroceryOrderDto,
  GroceryCheckoutPreviewDto,
  UpdateGroceryOrderDto,
} from '../dto/grocery-order.dto';
import { GroceryOrderService } from '../services/grocery-order.service';

@ApiTags('(Parent) > Kitchen > Grocery Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PARENT, UserRole.NANNY, UserRole.ADMIN)
@Controller('parent/kitchen')
export class GroceryOrderController {
  constructor(private readonly groceryOrderService: GroceryOrderService) {}

  @Get('stores')
  @ApiOperation({ summary: 'Get partner stores available for grocery orders' })
  getStores(
    @CurrentUser() user: CurrentUserPayload,
    @Query('userId') userId?: string,
  ) {
    return this.groceryOrderService.getAvailableStores(user, userId);
  }

  @Post('checkout/preview')
  @ApiOperation({
    summary:
      'Build a shopping voucher preview with store options, totals, and saved cards',
  })
  previewCheckout(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: GroceryCheckoutPreviewDto,
  ) {
    return this.groceryOrderService.previewCheckout(user, dto);
  }

  @Post('orders')
  @ApiOperation({
    summary:
      'Create a grocery order from shopping items and optionally charge a saved Stripe card',
  })
  createOrder(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateGroceryOrderDto,
  ) {
    return this.groceryOrderService.createOrder(user, dto);
  }

  @Get('orders')
  @ApiOperation({ summary: 'Get my grocery orders' })
  listOrders(@CurrentUser() user: CurrentUserPayload) {
    return this.groceryOrderService.listOrders(user);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Get one grocery order detail' })
  getOrder(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') orderId: string,
  ) {
    return this.groceryOrderService.getOrderById(user, orderId);
  }

  @Patch('orders/:id')
  @ApiOperation({ summary: 'Update a grocery order with a compact action payload' })
  updateOrder(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') orderId: string,
    @Body() dto: UpdateGroceryOrderDto,
  ) {
    return this.groceryOrderService.updateOrder(user, orderId, dto);
  }
}
