import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateMembershipStripePaymentIntentDto } from '../dto/stripe-payment.dto';
import { MembershipStripeService } from './membership-stripe.service';
import { MembershipSubscriptionService } from './membership-subscription.service';
import { extractMembershipUserId } from '../utils/extract-user-id.util';
import { PaymentAccountService } from '../../payment/payment-account.service';
import Stripe from 'stripe';
import { computeMembershipPricing } from '../utils/membership-pricing.util';

@Injectable()
export class MembershipBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipStripeService: MembershipStripeService,
    private readonly membershipSubscriptionService: MembershipSubscriptionService,
    private readonly paymentAccountService: PaymentAccountService,
  ) {}

  async createStripePaymentIntent(
    userParam: any,
    dto: CreateMembershipStripePaymentIntentDto,
  ) {
    const userId = extractMembershipUserId(userParam);
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: dto.planId },
    });

    if (!plan) {
      throw new BadRequestException('Membership plan not found.');
    }

    const childCount = await this.prisma.child.count({
      where: { parentUserId: userId },
    });
    const pricing = computeMembershipPricing(plan, childCount);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const payerPaymentMethod =
      await this.paymentAccountService.resolveSelectedPaymentMethod(
        userId,
        dto.paymentMethodId,
      );
    const stripeChargeSource =
      await this.paymentAccountService.getStripeChargeSource(
        userId,
        dto.paymentMethodId,
      );
    const recipient = await this.paymentAccountService.resolvePaymentRecipient(
      'MEMBERSHIP_SUBSCRIPTION',
    );

    const intent = await this.membershipStripeService.createPaymentIntentForPlan(
      userId,
      user?.email,
      plan,
      recipient
        ? {
            recipientUserId: recipient.targetUserId,
            recipientRole: recipient.targetRole,
          }
        : undefined,
      recipient,
      stripeChargeSource,
      {
        amount: pricing.totalAmount,
        currency: pricing.totalCurrency,
        description: `${plan.name} membership for ${Math.max(
          childCount,
          1,
        )} child${Math.max(childCount, 1) > 1 ? 'ren' : ''}`,
        metadata: {
          childCount: String(childCount),
          additionalChildren: String(pricing.additionalChildren),
        },
      },
    );

    return {
      ...intent,
      pricing,
      payerPaymentMethod,
    };
  }

  async createStripeCheckoutSession(
    userParam: any,
    planId: string,
    successUrl?: string,
    cancelUrl?: string,
  ) {
    const userId = extractMembershipUserId(userParam);
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new BadRequestException('Membership plan not found.');
    }

    const childCount = await this.prisma.child.count({
      where: { parentUserId: userId },
    });
    const pricing = computeMembershipPricing(plan, childCount);

    const recipient = await this.paymentAccountService.resolvePaymentRecipient(
      'MEMBERSHIP_SUBSCRIPTION',
    );

    const payerPaymentMethod =
      await this.paymentAccountService.resolveSelectedPaymentMethod(userId);
    const session = await this.membershipStripeService.createCheckoutSession(
      userId,
      plan,
      this.appBaseUrl(),
      successUrl,
      cancelUrl,
      recipient
        ? {
            recipientUserId: recipient.targetUserId,
            recipientRole: recipient.targetRole,
          }
        : undefined,
      recipient,
      {
        amount: pricing.totalAmount,
        currency: pricing.totalCurrency,
        description: `${plan.name} membership for ${Math.max(
          childCount,
          1,
        )} child${Math.max(childCount, 1) > 1 ? 'ren' : ''}`,
        metadata: {
          childCount: String(childCount),
          additionalChildren: String(pricing.additionalChildren),
        },
      },
    );

    return {
      ...session,
      pricing,
      payerPaymentMethod,
    };
  }

  async handleStripeWebhook(signature: string, rawBody: Buffer) {
    let event: Stripe.Event;
    try {
      event = this.membershipStripeService.constructWebhookEvent(
        signature,
        rawBody,
      );
    } catch (error: any) {
      throw new BadRequestException(
        `Webhook signature verification failed: ${error.message}`,
      );
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const userId = paymentIntent.metadata?.userId;
        const planId = paymentIntent.metadata?.planId;

        if (userId && planId) {
          await this.membershipSubscriptionService.subscribePlan(userId, {
            planId,
            paymentIntentId: paymentIntent.id,
          });
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const userId = paymentIntent.metadata?.userId;

        if (userId) {
          await this.membershipSubscriptionService.simulatePaymentFailure(
            userId,
            {
              amount: paymentIntent.amount / 100,
              reason:
                paymentIntent.last_payment_error?.message ||
                'Stripe payment attempt failed.',
            },
          );
        }
        break;
      }
    }

    return { received: true };
  }

  private appBaseUrl() {
    return (
      process.env.APP_BASE_URL ||
      `http://localhost:${process.env.PORT ?? 5000}`
    );
  }
}
