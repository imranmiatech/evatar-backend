import { BadRequestException, Injectable } from '@nestjs/common';
import { MembershipBillingService } from '../membership/services/membership-billing.service';
import { MembershipSubscriptionService } from '../membership/services/membership-subscription.service';
import { PaymentService } from './payment.service';
import {
  UnifiedPaymentCheckoutDto,
  UnifiedPaymentType,
} from './dto/unified-payment-checkout.dto';

@Injectable()
export class UnifiedPaymentService {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly membershipSubscriptionService: MembershipSubscriptionService,
    private readonly membershipBillingService: MembershipBillingService,
  ) {}

  async checkout(userId: string, dto: UnifiedPaymentCheckoutDto) {
    switch (dto.paymentType) {
      case UnifiedPaymentType.MEMBERSHIP: {
        if (!dto.planId) {
          throw new BadRequestException(
            'planId is required for MEMBERSHIP payment.',
          );
        }

        const result =
          dto.paymentIntentId || dto.paymentMethodId
            ? await this.membershipSubscriptionService.subscribePlan(userId, {
                planId: dto.planId,
                paymentMethodId: dto.paymentMethodId,
                paymentIntentId: dto.paymentIntentId,
              })
            : await this.membershipBillingService.createStripeCheckoutSession(
                { userId },
                dto.planId,
                dto.successUrl,
                dto.cancelUrl,
              );

        return {
          paymentType: dto.paymentType,
          route:
            dto.paymentIntentId || dto.paymentMethodId
              ? '/api/v1/payment/checkout'
              : '/api/v1/membership/stripe/create-checkout-session',
          result,
        };
      }
      case UnifiedPaymentType.NANNY_TIP: {
        if (!dto.nannyUserId) {
          throw new BadRequestException(
            'nannyUserId is required for NANNY_TIP payment.',
          );
        }

        if (!dto.amount) {
          throw new BadRequestException(
            'amount is required for NANNY_TIP payment.',
          );
        }

        const result = await this.paymentService.createTipPaymentIntent(userId, {
          nannyUserId: dto.nannyUserId,
          childId: dto.childId,
          amount: dto.amount,
          currency: dto.currency,
          note: dto.note,
          paymentMethodId: dto.paymentMethodId,
        });

        return {
          paymentType: dto.paymentType,
          route: '/api/v1/payment/checkout',
          result,
        };
      }
      case UnifiedPaymentType.PARTNER_PRODUCT: {
        if (!dto.productId) {
          throw new BadRequestException(
            'productId is required for PARTNER_PRODUCT payment.',
          );
        }

        if (!dto.amount) {
          throw new BadRequestException(
            'amount is required for PARTNER_PRODUCT payment.',
          );
        }

        const result =
          await this.paymentService.createPartnerProductPaymentIntent(userId, {
            productId: dto.productId,
            amount: dto.amount,
            currency: dto.currency,
            paymentMethodId: dto.paymentMethodId,
          });

        return {
          paymentType: dto.paymentType,
          route: '/api/v1/payment/checkout',
          result,
        };
      }
      default:
        throw new BadRequestException(
          'Unsupported paymentType. Use MEMBERSHIP, NANNY_TIP, or PARTNER_PRODUCT.',
        );
    }
  }
}
