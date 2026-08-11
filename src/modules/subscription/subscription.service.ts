import {
  Injectable,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSubscriptionPlanDto } from './dto/create-plan.dto';
import { SubscribePlanDto } from './dto/subscribe-plan.dto';
import { PauseSubscriptionDto } from './dto/pause-subscription.dto';
import { CancelFeedbackDto } from './dto/cancel-feedback.dto';
import { AddSubscriptionPaymentMethodDto } from './dto/add-payment-method.dto';
import { SimulatePaymentFailureDto } from './dto/simulate-payment-failure.dto';
import { CreateStripePaymentIntentDto } from './dto/stripe-payment.dto';
import {
  SubscriptionInterval,
  SubscriptionStatus,
  TransactionStatus,
} from '@prisma/client';
import Stripe from 'stripe';

@Injectable()
export class SubscriptionService implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionService.name);
  private stripe: Stripe;

  constructor(private readonly prisma: PrismaService) {
    const secretKey = process.env.STRIPE_SECRET_KEY || '';
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia' as any,
    });
  }

  async onModuleInit() {
    if (process.env.AUTO_SEED_SUBSCRIPTION_PLANS !== 'true') {
      return;
    }

    try {
      await this.seedDefaultPlans();
    } catch (error) {
      this.logger.warn(
        `Skipping subscription plan auto-seed during startup: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Seed standard plans if they do not exist
   */
  async seedDefaultPlans() {
    const existingPlans = await this.prisma.subscriptionPlan.count();
    if (existingPlans === 0) {
      const defaultFeatures = [
        'Customized daily routines for every child—no micromanagement needed.',
        'Nanny insights grounded in real-life experiences.',
        'Unique bedtime stories crafted from their daily adventures.',
        'Personalised daily flow per child (meals, activities, rest)',
        'At-home + local activity suggestions',
        'Care Layers (caregiver training tailored to child age & stage)',
        'Nightly personalised bedtime stories per child',
        'Unlimited Care Assist (real-time support)',
        'Access to Alurei Membership Partner Perks',
      ];

      await this.prisma.subscriptionPlan.createMany({
        data: [
          {
            name: '2 child Family Membership',
            maxChildren: 2,
            price: 60.0,
            currency: 'AED',
            interval: SubscriptionInterval.MONTHLY,
            features: ['Manage 2 child maximum at a time', ...defaultFeatures],
          },
          {
            name: '4 child Family Membership',
            maxChildren: 4,
            price: 120.0,
            currency: 'AED',
            interval: SubscriptionInterval.MONTHLY,
            features: ['Manage 4 child maximum at a time', ...defaultFeatures],
          },
          {
            name: '10 child Family Membership',
            maxChildren: 10,
            price: 300.0,
            currency: 'AED',
            interval: SubscriptionInterval.MONTHLY,
            features: ['Manage 10 child maximum at a time', ...defaultFeatures],
          },
          {
            name: 'Family Plus',
            maxChildren: 10,
            price: 499.0,
            currency: 'AED',
            interval: SubscriptionInterval.ANNUALLY,
            savingsText: 'Save AUD 19 by choosing annual billing.',
            features: [
              'Save AUD 19 by choosing annual billing.',
              'Priority 24/7 Concierge Support',
              'Manage up to 10 children',
              ...defaultFeatures,
            ],
          },
        ],
      });
    }
  }

  /**
   * Get all active subscription plans
   */
  async getAllPlans() {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });
  }

  /**
   * Helper to safely extract user ID from JWT payload or string
   */
  private extractUserId(userParam: any): string {
    if (typeof userParam === 'string') return userParam;
    const userId = userParam?.userId ?? userParam?.id ?? userParam?.sub;
    if (!userId) {
      throw new BadRequestException(
        'User ID could not be identified from authentication token.',
      );
    }
    return userId;
  }

  /**
   * Get current user's active subscription (or auto-create 7-day Free Trial if none exists)
   */
  async getMySubscription(userParam: any) {
    const userId = this.extractUserId(userParam);

    let sub = await this.prisma.userSubscription.findUnique({
      where: { userId },
      include: {
        plan: true,
      },
    });

    // Auto-initialize 7-day Free Trial for user if no subscription record exists
    if (!sub) {
      // Find default 2-child plan as target after trial
      const defaultPlan = await this.prisma.subscriptionPlan.findFirst({
        where: { maxChildren: 2 },
      });

      if (!defaultPlan) {
        throw new NotFoundException('Subscription plans not found.');
      }

      const now = new Date();
      const trialEnds = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days complimentary trial

      sub = await this.prisma.userSubscription.create({
        data: {
          userId,
          planId: defaultPlan.id,
          status: SubscriptionStatus.FREE_TRIAL,
          trialEndsAt: trialEnds,
          currentPeriodStart: now,
          currentPeriodEnd: trialEnds,
          nextBillingDate: trialEnds,
        },
        include: {
          plan: true,
        },
      });
    }

    // Calculate free trial days remaining
    let trialDaysRemaining = 0;
    if (sub.status === SubscriptionStatus.FREE_TRIAL && sub.trialEndsAt) {
      const diffMs = sub.trialEndsAt.getTime() - new Date().getTime();
      trialDaysRemaining = Math.max(
        0,
        Math.ceil(diffMs / (1000 * 60 * 60 * 24)),
      );
    }

    // Check for recent failed transaction
    const latestFailedInvoice = await this.prisma.subscriptionInvoice.findFirst(
      {
        where: {
          userId,
          status: TransactionStatus.FAILED,
        },
        orderBy: { invoiceDate: 'desc' },
      },
    );

    const isPaymentFailed =
      !!latestFailedInvoice && sub.status === SubscriptionStatus.PAUSED;

    return {
      id: sub.id,
      userId: sub.userId,
      status: sub.status,
      plan: sub.plan,
      trialEndsAt: sub.trialEndsAt,
      trialDaysRemaining,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      nextBillingDate: sub.nextBillingDate,
      isPaused: sub.isPaused,
      pausedAt: sub.pausedAt,
      resumeAt: sub.resumeAt,
      pauseDurationWeeks: sub.pauseDurationWeeks,
      isCancelled: sub.isCancelled,
      cancelledAt: sub.cancelledAt,
      accessEndsAt: sub.accessEndsAt,
      isPaymentFailed,
      latestFailedInvoice: isPaymentFailed ? latestFailedInvoice : null,
    };
  }

  /**
   * Subscribe / Upgrade plan
   */
  async subscribePlan(userParam: any, dto: SubscribePlanDto) {
    const userId = this.extractUserId(userParam);

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: dto.planId },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found.');
    }

    // Determine payment method to use/charge
    let paymentMethod: any = null;
    if (dto.paymentMethodId) {
      paymentMethod = await this.prisma.paymentMethod.findFirst({
        where: { id: dto.paymentMethodId, userId },
      });
    }

    if (!paymentMethod) {
      paymentMethod = await this.prisma.paymentMethod.findFirst({
        where: { userId, isDefault: true },
      });
    }

    // If user provided direct card details during checkout, save card for user
    if (!paymentMethod && dto.cardBrand && dto.cardLast4) {
      paymentMethod = await this.prisma.paymentMethod.create({
        data: {
          userId,
          brand: dto.cardBrand,
          last4: dto.cardLast4,
          expMonth: 12,
          expYear: 2028,
          isDefault: true,
        },
      });
    }

    // Execute Real Stripe Payment Charge
    let stripePaymentIntentId: string | null = dto.paymentIntentId || null;

    if (this.stripe) {
      try {
        if (!stripePaymentIntentId) {
          const amountInCents = Math.round(plan.price * 100);
          const paymentIntent = await this.stripe.paymentIntents.create({
            amount: amountInCents,
            currency: (plan.currency || 'aed').toLowerCase(),
            payment_method_types: ['card'],
            payment_method: 'pm_card_visa', // Standard Stripe test card
            confirm: true,
            description: `Evatar Subscription - ${plan.name} (${userId})`,
            metadata: {
              userId,
              planId: plan.id,
              planName: plan.name,
            },
          });

          stripePaymentIntentId = paymentIntent.id;
        } else {
          const retrieved = await this.stripe.paymentIntents.retrieve(
            stripePaymentIntentId,
          );
          if (retrieved.status !== 'succeeded') {
            throw new Error(
              `Stripe payment intent status is ${retrieved.status}`,
            );
          }
        }
      } catch (stripeErr: any) {
        this.logger.error(
          `Stripe payment processing failed: ${stripeErr.message}`,
        );

        // Log failed invoice
        await this.prisma.subscriptionInvoice.create({
          data: {
            userId,
            planName: plan.name,
            amount: plan.price,
            currency: plan.currency,
            status: TransactionStatus.FAILED,
            failureReason: stripeErr.message || 'Stripe card processing failed',
            invoiceDate: new Date(),
          },
        });

        // Flag user subscription as payment failed
        await this.prisma.userSubscription.updateMany({
          where: { userId },
          data: { isPaymentFailed: true },
        });

        throw new BadRequestException(
          `Stripe Payment Failed: ${stripeErr.message}`,
        );
      }
    }

    const now = new Date();
    const periodEnd = new Date(now);
    if (plan.interval === SubscriptionInterval.ANNUALLY) {
      periodEnd.setFullYear(now.getFullYear() + 1);
    } else {
      periodEnd.setMonth(now.getMonth() + 1);
    }

    // Upsert subscription
    const sub = await this.prisma.userSubscription.upsert({
      where: { userId },
      create: {
        userId,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        nextBillingDate: periodEnd,
        isPaused: false,
        isCancelled: false,
        isPaymentFailed: false,
      },
      update: {
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        nextBillingDate: periodEnd,
        isPaused: false,
        pausedAt: null,
        resumeAt: null,
        pauseDurationWeeks: null,
        isCancelled: false,
        cancelledAt: null,
        accessEndsAt: null,
        isPaymentFailed: false,
      },
      include: { plan: true },
    });

    // Create success invoice record
    const invoice = await this.prisma.subscriptionInvoice.create({
      data: {
        userId,
        planName: plan.name,
        amount: plan.price,
        currency: plan.currency,
        status: TransactionStatus.SUCCESS,
        invoiceDate: now,
      },
    });

    return {
      message: `Successfully subscribed to ${plan.name}`,
      stripePaymentIntentId,
      subscription: sub,
      invoice,
      chargedPaymentMethod: paymentMethod
        ? {
            id: paymentMethod.id,
            brand: paymentMethod.brand,
            last4: paymentMethod.last4,
          }
        : { brand: dto.cardBrand || 'Visa', last4: dto.cardLast4 || '4242' },
    };
  }

  /**
   * Claim 7-day Complimentary Family Membership Trial
   */
  async claimComplimentaryTrial(userParam: any, planId?: string) {
    const userId = this.extractUserId(userParam);

    let targetPlan: any = null;
    if (planId) {
      targetPlan = await this.prisma.subscriptionPlan.findUnique({
        where: { id: planId },
      });
    }

    if (!targetPlan) {
      targetPlan = await this.prisma.subscriptionPlan.findFirst({
        where: { maxChildren: 2 },
      });
    }

    if (!targetPlan) {
      throw new NotFoundException('Subscription plan not found.');
    }

    const now = new Date();
    const trialEnds = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const sub = await this.prisma.userSubscription.upsert({
      where: { userId },
      create: {
        userId,
        planId: targetPlan.id,
        status: SubscriptionStatus.FREE_TRIAL,
        trialEndsAt: trialEnds,
        currentPeriodStart: now,
        currentPeriodEnd: trialEnds,
        nextBillingDate: trialEnds,
        isPaused: false,
        isCancelled: false,
      },
      update: {
        planId: targetPlan.id,
        status: SubscriptionStatus.FREE_TRIAL,
        trialEndsAt: trialEnds,
        currentPeriodStart: now,
        currentPeriodEnd: trialEnds,
        nextBillingDate: trialEnds,
        isPaused: false,
        pausedAt: null,
        resumeAt: null,
        pauseDurationWeeks: null,
        isCancelled: false,
        cancelledAt: null,
        accessEndsAt: null,
      },
      include: { plan: true },
    });

    return {
      message:
        'Successfully claimed your 7-Day Complimentary Family Membership Trial!',
      trialDaysRemaining: 7,
      subscription: sub,
    };
  }

  /**
   * Pause subscription for specified weeks or custom date
   */
  async pauseSubscription(userParam: any, dto: PauseSubscriptionDto) {
    const userId = this.extractUserId(userParam);

    const sub = await this.prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (!sub) {
      throw new NotFoundException('No active subscription found.');
    }

    const now = new Date();
    let resumeAt: Date;
    let weeks = dto.durationWeeks || 2;

    if (dto.customResumeDate) {
      resumeAt = new Date(dto.customResumeDate);
    } else {
      resumeAt = new Date(now.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
    }

    // Shift next billing date forward
    const nextBilling = sub.nextBillingDate
      ? new Date(
          sub.nextBillingDate.getTime() + (resumeAt.getTime() - now.getTime()),
        )
      : resumeAt;

    const updated = await this.prisma.userSubscription.update({
      where: { userId },
      data: {
        status: SubscriptionStatus.PAUSED,
        isPaused: true,
        pausedAt: now,
        resumeAt,
        pauseDurationWeeks: weeks,
        nextBillingDate: nextBilling,
      },
      include: { plan: true },
    });

    return {
      message: `Subscription paused until ${resumeAt.toISOString().split('T')[0]}`,
      subscription: updated,
    };
  }

  /**
   * Resume paused subscription
   */
  async resumeSubscription(userParam: any) {
    const userId = this.extractUserId(userParam);

    const sub = await this.prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (!sub) {
      throw new NotFoundException('No subscription found.');
    }

    const updated = await this.prisma.userSubscription.update({
      where: { userId },
      data: {
        status: SubscriptionStatus.ACTIVE,
        isPaused: false,
        pausedAt: null,
        resumeAt: null,
        pauseDurationWeeks: null,
      },
      include: { plan: true },
    });

    return {
      message: 'Subscription successfully resumed.',
      subscription: updated,
    };
  }

  /**
   * Submit cancellation feedback survey (Step 1 of cancel flow)
   */
  async submitCancelFeedback(userParam: any, dto: CancelFeedbackDto) {
    const userId = this.extractUserId(userParam);

    const sub = await this.prisma.userSubscription.findUnique({
      where: { userId },
    });

    const feedback = await this.prisma.subscriptionCancelFeedback.create({
      data: {
        userId,
        subscriptionId: sub?.id || null,
        reason: dto.reason,
        detailNote: dto.detailNote || null,
      },
    });

    return {
      message: 'Cancellation feedback submitted successfully.',
      feedback,
    };
  }

  /**
   * Confirm cancellation (Step 2 & 3 of cancel flow)
   */
  async confirmCancelSubscription(userParam: any) {
    const userId = this.extractUserId(userParam);

    const sub = await this.prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (!sub) {
      throw new NotFoundException('No active subscription found.');
    }

    const now = new Date();
    // Access continues until end of current billing period
    const accessEndsAt =
      sub.currentPeriodEnd ||
      new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const updated = await this.prisma.userSubscription.update({
      where: { userId },
      data: {
        status: SubscriptionStatus.CANCELLED,
        isCancelled: true,
        cancelledAt: now,
        accessEndsAt,
      },
      include: { plan: true },
    });

    return {
      message: 'Membership cancelled.',
      accessEndsAt,
      subscription: updated,
    };
  }

  /**
   * Reactivate cancelled or paused subscription
   */
  async reactivateSubscription(userParam: any) {
    const userId = this.extractUserId(userParam);

    const sub = await this.prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (!sub) {
      throw new NotFoundException(
        'No subscription record found to reactivate.',
      );
    }

    const updated = await this.prisma.userSubscription.update({
      where: { userId },
      data: {
        status: SubscriptionStatus.ACTIVE,
        isCancelled: false,
        cancelledAt: null,
        accessEndsAt: null,
        isPaused: false,
        pausedAt: null,
        resumeAt: null,
      },
      include: { plan: true },
    });

    return {
      message: 'Membership reactivated successfully!',
      subscription: updated,
    };
  }

  /**
   * Get user's saved payment methods
   */
  async getPaymentMethods(userParam: any) {
    const userId = this.extractUserId(userParam);

    return this.prisma.paymentMethod.findMany({
      where: { userId },
      orderBy: { isDefault: 'desc' },
    });
  }

  /**
   * Add a new saved payment card
   */
  async addPaymentMethod(userParam: any, dto: AddSubscriptionPaymentMethodDto) {
    const userId = this.extractUserId(userParam);

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

    const newMethod = await this.prisma.paymentMethod.create({
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

    return newMethod;
  }

  /**
   * Set default payment method
   */
  async setDefaultPaymentMethod(userParam: any, paymentMethodId: string) {
    const userId = this.extractUserId(userParam);

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

  /**
   * Delete payment method
   */
  async deletePaymentMethod(userParam: any, paymentMethodId: string) {
    const userId = this.extractUserId(userParam);

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

  /**
   * Get user billing transaction history (last 3 months)
   */
  async getBillingHistory(userParam: any) {
    const userId = this.extractUserId(userParam);

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    return this.prisma.subscriptionInvoice.findMany({
      where: {
        userId,
        invoiceDate: { gte: threeMonthsAgo },
      },
      orderBy: { invoiceDate: 'desc' },
    });
  }

  /**
   * Helper / Webhook simulation: Trigger failed payment pause alert
   */
  async simulatePaymentFailure(userParam: any, dto: SimulatePaymentFailureDto) {
    const userId = this.extractUserId(userParam);

    const sub = await this.prisma.userSubscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    const failedInvoice = await this.prisma.subscriptionInvoice.create({
      data: {
        userId,
        planName: sub?.plan.name || '02 Child Membership',
        amount: dto.amount || 99.0,
        currency: 'AED',
        status: TransactionStatus.FAILED,
        failureReason:
          dto.reason ||
          'We couldn’t process your 99 AED payment for the current billing cycle.',
      },
    });

    // Update subscription to PAUSED due to payment failure
    await this.prisma.userSubscription.update({
      where: { userId },
      data: {
        status: SubscriptionStatus.PAUSED,
        isPaused: true,
        pausedAt: new Date(),
      },
    });

    return {
      message: 'Payment failure simulated. User subscription marked as PAUSED.',
      failedInvoice,
    };
  }

  /**
   * Admin: Create a new custom plan
   */
  async createPlan(dto: CreateSubscriptionPlanDto) {
    return this.prisma.subscriptionPlan.create({
      data: {
        name: dto.name,
        maxChildren: dto.maxChildren,
        price: dto.price,
        currency: dto.currency || 'AED',
        interval: dto.interval || SubscriptionInterval.MONTHLY,
        savingsText: dto.savingsText || null,
        features: dto.features,
      },
    });
  }

  /**
   * Stripe Integration: Create PaymentIntent for Mobile App / Frontend PaymentSheet
   */
  async createStripePaymentIntent(
    userParam: any,
    dto: CreateStripePaymentIntentDto,
  ) {
    const userId = this.extractUserId(userParam);
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: dto.planId },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    // Amount in cents / smallest currency unit
    const amountInCents = Math.round(plan.price * 100);

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: amountInCents,
      currency: plan.currency.toLowerCase(),
      metadata: {
        userId,
        planId: plan.id,
        planName: plan.name,
      },
      receipt_email: user?.email || undefined,
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: plan.price,
      currency: plan.currency,
      planName: plan.name,
    };
  }

  /**
   * Stripe: Create hosted Checkout Session for live payments
   */
  async createStripeCheckoutSession(userParam: any, planId: string) {
    const userId = this.extractUserId(userParam);
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found.');
    }

    if (!this.stripe) {
      throw new BadRequestException('Stripe integration is not configured.');
    }

    const amountInCents = Math.round(plan.price * 100);

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: (plan.currency || 'aed').toLowerCase(),
            product_data: {
              name: `Evatar Subscription - ${plan.name}`,
              description: `Childcare & family management plan (${plan.maxChildren} children)`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `http://localhost:5000/subscription-flow-test.html?session_id={CHECKOUT_SESSION_ID}&plan_id=${plan.id}`,
      cancel_url: `http://localhost:5000/subscription-flow-test.html?canceled=true`,
      metadata: {
        userId,
        planId: plan.id,
      },
    });

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
    };
  }

  /**
   * Stripe Webhook event listener
   */
  async handleStripeWebhook(signature: string, rawBody: Buffer) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event: Stripe.Event;

    try {
      if (webhookSecret && signature) {
        event = this.stripe.webhooks.constructEvent(
          rawBody,
          signature,
          webhookSecret,
        );
      } else {
        event = JSON.parse(rawBody.toString()) as Stripe.Event;
      }
    } catch (err: any) {
      throw new BadRequestException(
        `Webhook signature verification failed: ${err.message}`,
      );
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const userId = paymentIntent.metadata?.userId;
        const planId = paymentIntent.metadata?.planId;

        if (userId && planId) {
          await this.subscribePlan(userId, {
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
          await this.simulatePaymentFailure(userId, {
            amount: paymentIntent.amount / 100,
            reason:
              paymentIntent.last_payment_error?.message ||
              'Stripe payment attempt failed.',
          });
        }
        break;
      }
    }

    return { received: true };
  }
}
