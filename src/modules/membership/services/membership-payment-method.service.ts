import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AddMembershipPaymentMethodDto } from '../dto/add-payment-method.dto';

@Injectable()
export class MembershipPaymentMethodService {
  constructor(private readonly prisma: PrismaService) {}

  getPaymentMethods(userId: string) {
    return this.prisma.paymentMethod.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async addPaymentMethod(
    userId: string,
    dto: AddMembershipPaymentMethodDto,
  ) {
    const existingCount = await this.prisma.paymentMethod.count({
      where: { userId },
    });
    const shouldBeDefault = dto.isDefault || existingCount === 0;

    if (shouldBeDefault) {
      await this.prisma.paymentMethod.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    return this.prisma.paymentMethod.create({
      data: {
        userId,
        brand: dto.brand,
        last4: dto.last4,
        expMonth: dto.expMonth,
        expYear: dto.expYear,
        cardholderName: dto.cardholderName || null,
        isDefault: shouldBeDefault,
      },
    });
  }

  async setDefaultPaymentMethod(userId: string, paymentMethodId: string) {
    const method = await this.prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, userId },
    });

    if (!method) {
      throw new NotFoundException('Payment method not found.');
    }

    await this.prisma.paymentMethod.updateMany({
      where: { userId },
      data: { isDefault: false },
    });

    return this.prisma.paymentMethod.update({
      where: { id: paymentMethodId },
      data: { isDefault: true },
    });
  }

  async deletePaymentMethod(userId: string, paymentMethodId: string) {
    const method = await this.prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, userId },
    });

    if (!method) {
      throw new NotFoundException('Payment method not found.');
    }

    await this.prisma.paymentMethod.delete({
      where: { id: paymentMethodId },
    });

    return { message: 'Payment method removed successfully.' };
  }
}
