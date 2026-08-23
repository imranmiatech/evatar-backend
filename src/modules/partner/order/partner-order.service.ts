import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  formatGroceryOrder,
  groceryOrderInclude,
} from '../../parent/kitchen/utils/grocery-order-response.util';
import { UpdatePartnerOrderDto } from './dto/update-partner-order.dto';

@Injectable()
export class PartnerOrderService {
  constructor(private readonly prisma: PrismaService) {}

  async listOrders(user: CurrentUserPayload) {
    this.ensurePartner(user);

    const orders = await this.prisma.groceryOrder.findMany({
      where: { store: { userId: user.userId } },
      include: groceryOrderInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      message: 'Partner grocery orders fetched successfully',
      data: orders.map((order) => formatGroceryOrder(order)),
    };
  }

  async getOrderById(user: CurrentUserPayload, orderId: string) {
    this.ensurePartner(user);

    const order = await this.prisma.groceryOrder.findFirst({
      where: { id: orderId, store: { userId: user.userId } },
      include: groceryOrderInclude(),
    });

    if (!order) {
      throw new NotFoundException('Partner grocery order not found');
    }

    return {
      success: true,
      message: 'Partner grocery order fetched successfully',
      data: formatGroceryOrder(order),
    };
  }

  async updateOrder(
    user: CurrentUserPayload,
    orderId: string,
    dto: UpdatePartnerOrderDto,
  ) {
    this.ensurePartner(user);

    const order = await this.prisma.groceryOrder.findFirst({
      where: { id: orderId, store: { userId: user.userId } },
    });

    if (!order) {
      throw new NotFoundException('Partner grocery order not found');
    }

    const updated = await this.prisma.groceryOrder.update({
      where: { id: orderId },
      data: { status: dto.status },
      include: groceryOrderInclude(),
    });

    return {
      success: true,
      message: 'Partner grocery order updated successfully',
      data: formatGroceryOrder(updated),
    };
  }

  private ensurePartner(user: CurrentUserPayload) {
    if (user.role !== UserRole.PARTNER) {
      throw new ForbiddenException('Only partner users can access store orders');
    }
  }
}
