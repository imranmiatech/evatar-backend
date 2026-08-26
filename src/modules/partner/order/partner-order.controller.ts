import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
} from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { UpdatePartnerOrderDto } from './dto/update-partner-order.dto';
import { PartnerOrderService } from './partner-order.service';

@ApiTags('(Partner) > Grocery Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PARTNER)
@Controller('partner/grocery-orders')
export class PartnerOrderController {
  constructor(private readonly partnerOrderService: PartnerOrderService) {}

  @Get()
  @ApiOperation({ summary: 'Get grocery orders assigned to my partner store(s)' })
  listOrders(@CurrentUser() user: CurrentUserPayload) {
    return this.partnerOrderService.listOrders(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one grocery order assigned to my partner store' })
  getOrder(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') orderId: string,
  ) {
    return this.partnerOrderService.getOrderById(user, orderId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update grocery order delivery status as partner' })
  updateOrder(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') orderId: string,
    @Body() dto: UpdatePartnerOrderDto,
  ) {
    return this.partnerOrderService.updateOrder(user, orderId, dto);
  }
}
