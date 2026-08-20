import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  SubscriptionInterval,
  SubscriptionStatus,
  TransactionStatus,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CancelMembershipFeedbackDto } from '../dto/cancel-feedback.dto';
import { PauseMembershipDto } from '../dto/pause-membership.dto';
import { SimulateMembershipPaymentFailureDto } from '../dto/simulate-payment-failure.dto';
import { SubscribeMembershipPlanDto } from '../dto/subscribe-plan.dto';
import { MembershipStripeService } from './membership-stripe.service';

@Injectable()
export class MembershipSubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipStripeService: MembershipStripeService,
  ) {}

  async getMyMembership(userId: string) {
    let subscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!subscription) {
      const defaultPlan = await this.findDefaultTrialPlan();
      const now = new Date();
      const trialEnds = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      subscription = await this.prisma.userSubscription.create({
        data: {
          userId,
          planId: defaultPlan.id,
          status: SubscriptionStatus.FREE_TRIAL,
          trialEndsAt: trialEnds,
          currentPeriodStart: now,
          currentPeriodEnd: trialEnds,
          nextBillingDate: trialEnds,
        },
        include: { plan: true },
      });
    }

    let trialDaysRemaining = 0;
    if (
      subscription.status === SubscriptionStatus.FREE_TRIAL &&
      subscription.trialEndsAt
    ) {
      const diffMs = subscription.trialEndsAt.getTime() - Date.now();
      trialDaysRemaining = Math.max(
        0,
        Math.ceil(diffMs / (1000 * 60 * 60 * 24)),
      );
    }

    const latestFailedInvoice = await this.prisma.subscriptionInvoice.findFirst({
      where: {
        userId,
        status: TransactionStatus.FAILED,
      },
      orderBy: { invoiceDate: 'desc' },
    });

    const isPaymentFailed =
      !!latestFailedInvoice && subscription.status === SubscriptionStatus.PAUSED;

    return {
      id: subscription.id,
      userId: subscription.userId,
      status: subscription.status,
      plan: subscription.plan,
      trialEndsAt: subscription.trialEndsAt,
      trialDaysRemaining,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      nextBillingDate: subscription.nextBillingDate,
      isPaused: subscription.isPaused,
      pausedAt: subscription.pausedAt,
      resumeAt: subscription.resumeAt,
      pauseDurationWeeks: subscription.pauseDurationWeeks,
      isCancelled: subscription.isCancelled,
      cancelledAt: subscription.cancelledAt,
      accessEndsAt: subscription.accessEndsAt,
      isPaymentFailed,
      latestFailedInvoice: isPaymentFailed ? latestFailedInvoice : null,
    };
  }

  async subscribePlan(userId: string, dto: SubscribeMembershipPlanDto) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: dto.planId },
    });

    if (!plan) {
      throw new NotFoundException('Membership plan not found.');
    }

    let paymentMethod = await this.resolvePaymentMethod(userId, dto);
    let stripePaymentIntentId: string | null = dto.paymentIntentId || null;

    try {
      if (this.membershipStripeService.isConfigured()) {
        stripePaymentIntentId =
          await this.membershipStripeService.ensureSucceededPaymentForPlan(
            userId,
            plan,
            stripePaymentIntentId,
          );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Stripe card processing failed';

      await this.prisma.subscriptionInvoice.create({
        data: {
          userId,
          planName: plan.name,
          amount: plan.price,
          currency: plan.currency,
          status: TransactionStatus.FAILED,
          failureReason: message,
          invoiceDate: new Date(),
        },
      });

      await this.prisma.userSubscription.updateMany({
        where: { userId },
        data: { isPaymentFailed: true },
      });

      throw new BadRequestException(`Stripe Payment Failed: ${message}`);
    }

    const now = new Date();
    const periodEnd = this.periodEndForPlan(now, plan.interval);

    const subscription = await this.prisma.userSubscription.upsert({
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
      subscription,
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

  async claimComplimentaryTrial(userId: string, planId?: string) {
    let plan = planId
      ? await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } })
      : null;

    if (!plan) {
      plan = await this.findDefaultTrialPlan();
    }

    const now = new Date();
    const trialEnds = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const subscription = await this.prisma.userSubscription.upsert({
      where: { userId },
      create: {
        userId,
        planId: plan.id,
        status: SubscriptionStatus.FREE_TRIAL,
        trialEndsAt: trialEnds,
        currentPeriodStart: now,
        currentPeriodEnd: trialEnds,
        nextBillingDate: trialEnds,
        isPaused: false,
        isCancelled: false,
      },
      update: {
        planId: plan.id,
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
      subscription,
    };
  }

  async pauseMembership(userId: string, dto: PauseMembershipDto) {
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new NotFoundException('No active membership found.');
    }

    const now = new Date();
    const weeks = dto.durationWeeks || 2;
    const resumeAt = dto.customResumeDate
      ? new Date(dto.customResumeDate)
      : new Date(now.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);

    const nextBillingDate = subscription.nextBillingDate
      ? new Date(
          subscription.nextBillingDate.getTime() +
            (resumeAt.getTime() - now.getTime()),
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
        nextBillingDate,
      },
      include: { plan: true },
    });

    return {
      message: `Membership paused until ${resumeAt.toISOString().split('T')[0]}`,
      subscription: updated,
    };
  }

  async resumeMembership(userId: string) {
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new NotFoundException('No membership found.');
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
      message: 'Membership successfully resumed.',
      subscription: updated,
    };
  }

  async submitCancelFeedback(
    userId: string,
    dto: CancelMembershipFeedbackDto,
  ) {
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
    });

    const feedback = await this.prisma.subscriptionCancelFeedback.create({
      data: {
        userId,
        subscriptionId: subscription?.id || null,
        reason: dto.reason,
        detailNote: dto.detailNote || null,
      },
    });

    return {
      message: 'Cancellation feedback submitted successfully.',
      feedback,
    };
  }

  async confirmCancelMembership(userId: string) {
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new NotFoundException('No active membership found.');
    }

    const now = new Date();
    const accessEndsAt =
      subscription.currentPeriodEnd ||
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

  async reactivateMembership(userId: string) {
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new NotFoundException('No membership record found to reactivate.');
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

  getBillingHistory(userId: string) {
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

  async simulatePaymentFailure(
    userId: string,
    dto: SimulateMembershipPaymentFailureDto,
  ) {
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    const failedInvoice = await this.prisma.subscriptionInvoice.create({
      data: {
        userId,
        planName: subscription?.plan.name || '02 Child Membership',
        amount: dto.amount || 99.0,
        currency: subscription?.plan.currency || 'AED',
        status: TransactionStatus.FAILED,
        failureReason:
          dto.reason ||
          'We could not process your payment for the current billing cycle.',
      },
    });

    await this.prisma.userSubscription.update({
      where: { userId },
      data: {
        status: SubscriptionStatus.PAUSED,
        isPaused: true,
        pausedAt: new Date(),
        isPaymentFailed: true,
      },
    });

    return {
      message: 'Payment failure simulated. User membership marked as PAUSED.',
      failedInvoice,
    };
  }

  private async findDefaultTrialPlan() {
    const defaultPlan = await this.prisma.subscriptionPlan.findFirst({
      where: { maxChildren: 2, isActive: true },
      orderBy: [{ interval: 'asc' }, { price: 'asc' }],
    });

    if (!defaultPlan) {
      throw new NotFoundException('Membership plans not found.');
    }

    return defaultPlan;
  }

  private async resolvePaymentMethod(
    userId: string,
    dto: SubscribeMembershipPlanDto,
  ) {
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

    return paymentMethod;
  }

  private periodEndForPlan(startDate: Date, interval: SubscriptionInterval) {
    const next = new Date(startDate);
    if (interval === SubscriptionInterval.ANNUALLY) {
      next.setFullYear(next.getFullYear() + 1);
    } else {
      next.setMonth(next.getMonth() + 1);
    }

    return next;
  }
}
