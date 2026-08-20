import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateMembershipStripePaymentIntentDto } from '../dto/stripe-payment.dto';
import { MembershipStripeService } from './membership-stripe.service';
import { MembershipSubscriptionService } from './membership-subscription.service';
import { extractMembershipUserId } from '../utils/extract-user-id.util';
import Stripe from 'stripe';

@Injectable()
export class MembershipBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipStripeService: MembershipStripeService,
    private readonly membershipSubscriptionService: MembershipSubscriptionService,
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

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    return this.membershipStripeService.createPaymentIntentForPlan(
      userId,
      user?.email,
      plan,
    );
  }

  async createStripeCheckoutSession(userParam: any, planId: string) {
    const userId = extractMembershipUserId(userParam);
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new BadRequestException('Membership plan not found.');
    }

    return this.membershipStripeService.createCheckoutSession(
      userId,
      plan,
      this.appBaseUrl(),
    );
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
