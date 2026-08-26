import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  RewardLedgerSourceType,
  SubscriptionInterval,
  SubscriptionStatus,
  TransactionStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CancelMembershipFeedbackDto } from '../dto/cancel-feedback.dto';
import { CancelMembershipDto } from '../dto/cancel-membership.dto';
import { PauseMembershipDto } from '../dto/pause-membership.dto';
import { SimulateMembershipPaymentFailureDto } from '../dto/simulate-payment-failure.dto';
import { SubscribeMembershipPlanDto } from '../dto/subscribe-plan.dto';
import { MembershipStripeService } from './membership-stripe.service';
import { PaymentAccountService } from '../../payment/payment-account.service';
import { computeMembershipPricing } from '../utils/membership-pricing.util';
import { RewardsService } from '../../rewards/rewards.service';
import { MembershipStorageService } from './membership-storage.service';

const YEARLY_MEMBERSHIP_REWARD_POINTS = 100;
const MEMBERSHIP_RENEWAL_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class MembershipSubscriptionService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MembershipSubscriptionService.name);
  private renewalTimer: NodeJS.Timeout | null = null;
  private renewalInFlight = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipStripeService: MembershipStripeService,
    private readonly paymentAccountService: PaymentAccountService,
    private readonly membershipStorageService: MembershipStorageService,
    private readonly rewardsService: RewardsService,
  ) {}

  onModuleInit() {
    this.renewalTimer = setInterval(() => {
      void this.processDueRenewals();
    }, MEMBERSHIP_RENEWAL_INTERVAL_MS);

    void this.processDueRenewals();
  }

  onModuleDestroy() {
    if (this.renewalTimer) {
      clearInterval(this.renewalTimer);
      this.renewalTimer = null;
    }
  }

  async getMyMembership(userId: string) {
    const childCount = await this.getChildCount(userId);
    let subscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!subscription) {
      const defaultPlan = await this.findDefaultTrialPlan();
      const now = new Date();
      const trialEnds = new Date(
        now.getTime() + defaultPlan.trialDayPeriod * 24 * 60 * 60 * 1000,
      );

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

    subscription = await this.normalizeLifecycleState(subscription);

    if (!subscription) {
      throw new NotFoundException('Membership record could not be initialized.');
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
    const isTrialActive =
      subscription.status === SubscriptionStatus.FREE_TRIAL &&
      !!subscription.trialEndsAt &&
      subscription.trialEndsAt > new Date();
    const pricing = computeMembershipPricing(subscription.plan, childCount);
    const storageSummary =
      await this.membershipStorageService.getStorageSummary(userId);

    return {
      id: subscription.id,
      userId: subscription.userId,
      status: subscription.status,
      plan: subscription.plan,
      currentPlan: isTrialActive ? 'Free Trial' : subscription.plan.name,
      displayPrice: isTrialActive ? 0 : pricing.totalAmount,
      displayCurrency: isTrialActive ? 'AED' : pricing.totalCurrency,
      displayPeriod: pricing.periodLabel,
      childCount,
      pricing,
      storage: storageSummary,
      trialDescription: isTrialActive
        ? `Free trial active. The ${pricing.trialPlanLabel} will start automatically when your trial ends.`
        : null,
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

    if (!plan || !plan.isActive || plan.isComplimentary) {
      throw new NotFoundException('Membership plan not found.');
    }

    const childCount = await this.getChildCount(userId);
    const pricing = computeMembershipPricing(plan, childCount);
    const existingSubscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
      include: { plan: true },
    });
    const proration = this.calculateProrationCredit(
      existingSubscription,
      plan,
      childCount,
    );
    const amountToCharge = Math.max(
      0,
      Number((pricing.totalAmount - proration.creditAmount).toFixed(2)),
    );

    if (
      dto.paymentIntentId &&
      existingSubscription &&
      existingSubscription.planId === plan.id &&
      existingSubscription.status === SubscriptionStatus.ACTIVE &&
      !existingSubscription.isCancelled &&
      !existingSubscription.isPaused &&
      existingSubscription.currentPeriodEnd > new Date()
    ) {
      const recentInvoice = await this.prisma.subscriptionInvoice.findFirst({
        where: {
          userId,
          planName: plan.name,
          amount: amountToCharge,
          currency: pricing.totalCurrency,
          status: TransactionStatus.SUCCESS,
          invoiceDate: {
            gte: new Date(Date.now() - 15 * 60 * 1000),
          },
        },
        orderBy: { invoiceDate: 'desc' },
      });

      if (recentInvoice) {
        return {
          message: `Successfully subscribed to ${plan.name}`,
          stripePaymentIntentId: dto.paymentIntentId,
          subscription: existingSubscription,
          invoice: recentInvoice,
          pricing,
          billingRecipient: null,
          chargedPaymentMethod: null,
        };
      }
    }

    let paymentMethod = await this.resolvePaymentMethod(userId, dto);
    let stripePaymentIntentId: string | null = dto.paymentIntentId || null;
    const stripeChargeSource =
      await this.paymentAccountService.getStripeChargeSource(
        userId,
        dto.paymentMethodId,
      );
    const billingRecipient =
      await this.paymentAccountService.resolvePaymentRecipient(
        'MEMBERSHIP_SUBSCRIPTION',
      );

    try {
      if (this.membershipStripeService.isConfigured()) {
        stripePaymentIntentId =
          await this.membershipStripeService.ensureSucceededPaymentForPlan(
            userId,
            plan,
            stripePaymentIntentId,
            stripeChargeSource,
            billingRecipient
              ? {
                  recipientUserId: billingRecipient.targetUserId,
                  recipientRole: billingRecipient.targetRole,
                }
              : undefined,
            {
              amount: amountToCharge,
              currency: pricing.totalCurrency,
              description: `${plan.name} membership for ${Math.max(
                childCount,
                1,
              )} child${Math.max(childCount, 1) > 1 ? 'ren' : ''}`,
              metadata: {
                childCount: String(childCount),
                additionalChildren: String(pricing.additionalChildren),
                prorationCredit: String(proration.creditAmount),
                prorationSourcePlanId: proration.sourcePlanId || '',
              },
            },
          );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Stripe card processing failed';

      await this.prisma.subscriptionInvoice.create({
        data: {
          userId,
          planName: plan.name,
          amount: amountToCharge,
          currency: pricing.totalCurrency,
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
        trialEndsAt: null,
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
        trialEndsAt: null,
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
        amount: amountToCharge,
        currency: pricing.totalCurrency,
        status: TransactionStatus.SUCCESS,
        invoiceDate: now,
      },
    });

    const yearlyReward = await this.awardYearlyMembershipReward(
      userId,
      subscription.id,
      subscription.currentPeriodStart,
      plan,
    );

    return {
      message: `Successfully subscribed to ${plan.name}`,
      stripePaymentIntentId,
      subscription,
      invoice,
      pricing,
      proration,
      billingRecipient,
      yearlyReward,
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
    const existingSubscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (
      existingSubscription &&
      existingSubscription.status !== SubscriptionStatus.FREE_TRIAL
    ) {
      throw new BadRequestException(
        'Complimentary trial can only be claimed before a paid membership starts.',
      );
    }

    let plan = planId
      ? await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } })
      : null;

    if (!plan || !plan.isActive) {
      plan = await this.findDefaultTrialPlan();
    }

    if (!plan.isComplimentary) {
      throw new BadRequestException(
        'Only the complimentary/free plan can be used for trial access.',
      );
    }

    const now = new Date();
    const trialEnds = new Date(
      now.getTime() + plan.trialDayPeriod * 24 * 60 * 60 * 1000,
    );

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
        `Successfully claimed your ${plan.trialDayPeriod}-day complimentary family membership trial!`,
      trialDaysRemaining: plan.trialDayPeriod,
      subscription,
      currentPlan: 'Free Trial',
      childCount: await this.getChildCount(userId),
    };
  }

  async pauseMembership(userId: string, dto: PauseMembershipDto) {
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new NotFoundException('No active membership found.');
    }

    if (subscription.isCancelled) {
      throw new BadRequestException(
        'Cancelled memberships cannot be paused. Reactivate or subscribe again first.',
      );
    }

    if (subscription.status === SubscriptionStatus.FREE_TRIAL) {
      throw new BadRequestException('Free trial memberships cannot be paused.');
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

    if (!subscription.isPaused) {
      throw new BadRequestException('Membership is not paused.');
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

  async cancelMembership(userId: string, dto?: CancelMembershipDto) {
    if (dto?.reason) {
      await this.submitCancelFeedback(userId, {
        reason: dto.reason,
        detailNote: dto.detailNote,
      });
    }

    const result = await this.confirmCancelMembership(userId);

    return {
      ...result,
      feedbackSaved: !!dto?.reason,
    };
  }

  async confirmCancelMembership(userId: string) {
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new NotFoundException('No active membership found.');
    }

    if (subscription.isCancelled) {
      throw new BadRequestException('Membership is already cancelled.');
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

    if (!subscription.isCancelled && !subscription.isPaused) {
      throw new BadRequestException(
        'Membership is already active and does not need reactivation.',
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

  async validateChildAddition(userId: string) {
    const [existingChildren, subscription] = await Promise.all([
      this.getChildCount(userId),
      this.prisma.userSubscription.findUnique({
        where: { userId },
        include: { plan: true },
      }),
    ]);

    const nextChildCount = existingChildren + 1;

    if (!subscription || subscription.status === SubscriptionStatus.FREE_TRIAL) {
      const complimentaryPlan =
        subscription?.plan ?? (await this.findDefaultTrialPlan());
      const freeChildLimit = complimentaryPlan.maxChildren;

      if (freeChildLimit > 0 && nextChildCount > freeChildLimit) {
        throw new BadRequestException(
          `Free membership allows only ${freeChildLimit} child${freeChildLimit > 1 ? 'ren' : ''}. Upgrade to a paid membership to add more children.`,
        );
      }

      return {
        allowed: true,
        additionalChildCharge: null,
      };
    }

    const normalizedSubscription = await this.normalizeLifecycleState(subscription);
    if (!normalizedSubscription) {
      throw new NotFoundException('Membership record could not be initialized.');
    }

    if (
      normalizedSubscription.status !== SubscriptionStatus.ACTIVE ||
      normalizedSubscription.isCancelled ||
      normalizedSubscription.isPaused ||
      normalizedSubscription.isPaymentFailed
    ) {
      throw new BadRequestException(
        'Only active memberships can add additional children.',
      );
    }

    const includedChildren = Math.max(
      normalizedSubscription.plan.maxChildren,
      0,
    );

    if (nextChildCount <= includedChildren) {
      return {
        allowed: true,
        additionalChildCharge: null,
      };
    }

    const charge = await this.chargeAdditionalChildFee(
      userId,
      normalizedSubscription,
      nextChildCount,
    );

    return {
      allowed: true,
      additionalChildCharge: charge,
    };
  }

  private async findDefaultTrialPlan() {
    const defaultPlan = await this.prisma.subscriptionPlan.findFirst({
      where: { isActive: true, isComplimentary: true },
      orderBy: [{ sortOrder: 'asc' }, { interval: 'asc' }, { price: 'asc' }],
    });

    if (!defaultPlan) {
      throw new NotFoundException('Complimentary membership plan not found.');
    }

    return defaultPlan;
  }

  private async resolvePaymentMethod(
    userId: string,
    dto: SubscribeMembershipPlanDto,
  ) {
    let paymentMethod = await this.paymentAccountService.resolveSelectedPaymentMethod(
      userId,
      dto.paymentMethodId,
    );

    if (!paymentMethod && dto.cardBrand && dto.cardLast4) {
      paymentMethod = await this.paymentAccountService.addPaymentMethod(userId, {
        brand: dto.cardBrand,
        last4: dto.cardLast4,
        expMonth: 12,
        expYear: 2028,
        isDefault: true,
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

  private getChildCount(userId: string) {
    return this.prisma.child.count({
      where: { parentUserId: userId },
    });
  }

  private calculateProrationCredit(
    existingSubscription:
      | {
          id: string;
          planId: string;
          status: SubscriptionStatus;
          isCancelled: boolean;
          isPaused: boolean;
          isPaymentFailed: boolean;
          currentPeriodStart: Date;
          currentPeriodEnd: Date;
          plan: {
            id: string;
            name: string;
            price: number;
            currency: string;
            maxChildren: number;
            interval: SubscriptionInterval;
            additionalChildPrice: number | null;
            additionalChildCurrency: string | null;
            description: string | null;
            badgeText: string | null;
          };
        }
      | null,
    targetPlan: {
      id: string;
      currency: string;
    },
    childCount: number,
  ) {
    if (!existingSubscription) {
      return {
        applies: false,
        creditAmount: 0,
        creditCurrency: (targetPlan.currency || 'AED').toUpperCase(),
        sourcePlanId: null,
        remainingDays: 0,
      };
    }

    const isPaidActiveSubscription =
      existingSubscription.status === SubscriptionStatus.ACTIVE &&
      !existingSubscription.isCancelled &&
      !existingSubscription.isPaused &&
      !existingSubscription.isPaymentFailed;

    if (
      !isPaidActiveSubscription ||
      existingSubscription.planId === targetPlan.id ||
      !existingSubscription.currentPeriodEnd ||
      existingSubscription.currentPeriodEnd <= new Date()
    ) {
      return {
        applies: false,
        creditAmount: 0,
        creditCurrency: (targetPlan.currency || 'AED').toUpperCase(),
        sourcePlanId: existingSubscription.planId,
        remainingDays: 0,
      };
    }

    const sourceCurrency = (existingSubscription.plan.currency || 'AED').toUpperCase();
    const targetCurrency = (targetPlan.currency || 'AED').toUpperCase();
    if (sourceCurrency !== targetCurrency) {
      return {
        applies: false,
        creditAmount: 0,
        creditCurrency: targetCurrency,
        sourcePlanId: existingSubscription.planId,
        remainingDays: 0,
      };
    }

    const periodStartMs = existingSubscription.currentPeriodStart.getTime();
    const periodEndMs = existingSubscription.currentPeriodEnd.getTime();
    const nowMs = Date.now();
    const totalPeriodMs = periodEndMs - periodStartMs;
    const remainingMs = Math.max(0, periodEndMs - nowMs);

    if (totalPeriodMs <= 0 || remainingMs <= 0) {
      return {
        applies: false,
        creditAmount: 0,
        creditCurrency: targetCurrency,
        sourcePlanId: existingSubscription.planId,
        remainingDays: 0,
      };
    }

    const existingPricing = computeMembershipPricing(
      existingSubscription.plan,
      childCount,
    );
    const creditAmount = Number(
      ((existingPricing.totalAmount * remainingMs) / totalPeriodMs).toFixed(2),
    );

    return {
      applies: creditAmount > 0,
      creditAmount,
      creditCurrency: targetCurrency,
      sourcePlanId: existingSubscription.planId,
      remainingDays: Math.ceil(remainingMs / (1000 * 60 * 60 * 24)),
    };
  }

  async processDueRenewals() {
    if (this.renewalInFlight) {
      return;
    }

    this.renewalInFlight = true;

    try {
      const dueSubscriptions = await this.prisma.userSubscription.findMany({
        where: {
          status: SubscriptionStatus.ACTIVE,
          isCancelled: false,
          isPaused: false,
          isPaymentFailed: false,
          nextBillingDate: { lte: new Date() },
        },
        include: { plan: true },
        take: 25,
        orderBy: { nextBillingDate: 'asc' },
      });

      for (const subscription of dueSubscriptions) {
        await this.renewSubscription(subscription);
      }
    } catch (error) {
      this.logger.error(
        `Membership auto-renewal scan failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      this.renewalInFlight = false;
    }
  }

  private async chargeAdditionalChildFee(
    userId: string,
    subscription: {
      id: string;
      planId: string;
      plan: {
        id: string;
        name: string;
        price: number;
        currency: string;
        interval: SubscriptionInterval;
        additionalChildPrice: number | null;
        additionalChildCurrency: string | null;
      };
    },
    nextChildCount: number,
  ) {
    const additionalChildPrice = Number(
      subscription.plan.additionalChildPrice ?? 0,
    );
    const additionalChildCurrency = (
      subscription.plan.additionalChildCurrency ||
      subscription.plan.currency ||
      'AED'
    ).toUpperCase();

    if (additionalChildPrice <= 0) {
      throw new BadRequestException(
        'This membership plan does not allow adding more children.',
      );
    }

    const stripeChargeSource =
      await this.paymentAccountService.getStripeChargeSource(userId);

    try {
      if (this.membershipStripeService.isConfigured()) {
        await this.membershipStripeService.ensureSucceededPaymentForPlan(
          userId,
          subscription.plan as any,
          null,
          stripeChargeSource,
          undefined,
          {
            amount: additionalChildPrice,
            currency: additionalChildCurrency,
            description: `${subscription.plan.name} additional child charge for child #${nextChildCount}`,
            metadata: {
              chargeType: 'ADDITIONAL_CHILD',
              nextChildCount: String(nextChildCount),
            },
          },
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Additional child payment failed';

      await this.prisma.subscriptionInvoice.create({
        data: {
          userId,
          planName: `${subscription.plan.name} Additional Child`,
          amount: additionalChildPrice,
          currency: additionalChildCurrency,
          status: TransactionStatus.FAILED,
          failureReason: message,
          invoiceDate: new Date(),
        },
      });

      throw new BadRequestException(
        `Additional child payment is required before adding a new child: ${message}`,
      );
    }

    await this.prisma.subscriptionInvoice.create({
      data: {
        userId,
        planName: `${subscription.plan.name} Additional Child`,
        amount: additionalChildPrice,
        currency: additionalChildCurrency,
        status: TransactionStatus.SUCCESS,
        invoiceDate: new Date(),
      },
    });

    return {
      amount: additionalChildPrice,
      currency: additionalChildCurrency,
      childNumber: nextChildCount,
    };
  }

  private async renewSubscription(subscription: {
    id: string;
    userId: string;
    planId: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    nextBillingDate: Date | null;
    plan: {
      id: string;
      name: string;
      price: number;
      currency: string;
      interval: SubscriptionInterval;
      additionalChildPrice: number | null;
      additionalChildCurrency: string | null;
      maxChildren: number;
      description?: string | null;
      badgeText?: string | null;
    };
  }) {
    const childCount = await this.getChildCount(subscription.userId);
    const pricing = computeMembershipPricing(subscription.plan, childCount);

    try {
      const stripeChargeSource =
        await this.paymentAccountService.getStripeChargeSource(
          subscription.userId,
        );

      if (!this.membershipStripeService.isConfigured()) {
        throw new Error('Stripe integration is not configured.');
      }

      await this.membershipStripeService.ensureSucceededPaymentForPlan(
        subscription.userId,
        subscription.plan as any,
        null,
        stripeChargeSource,
        undefined,
        {
          amount: pricing.totalAmount,
          currency: pricing.totalCurrency,
          description: `${subscription.plan.name} membership auto-renewal`,
          metadata: {
            renewalType: 'AUTO_RENEWAL',
            childCount: String(childCount),
            additionalChildren: String(pricing.additionalChildren),
          },
        },
      );

      const nextPeriodStart = subscription.nextBillingDate || new Date();
      const nextPeriodEnd = this.periodEndForPlan(
        nextPeriodStart,
        subscription.plan.interval,
      );

      const updatedSubscription = await this.prisma.userSubscription.update({
        where: { userId: subscription.userId },
        data: {
          currentPeriodStart: nextPeriodStart,
          currentPeriodEnd: nextPeriodEnd,
          nextBillingDate: nextPeriodEnd,
          status: SubscriptionStatus.ACTIVE,
          isPaused: false,
          isPaymentFailed: false,
        },
        include: { plan: true },
      });

      await this.prisma.subscriptionInvoice.create({
        data: {
          userId: subscription.userId,
          planName: subscription.plan.name,
          amount: pricing.totalAmount,
          currency: pricing.totalCurrency,
          status: TransactionStatus.SUCCESS,
          invoiceDate: new Date(),
        },
      });

      await this.awardYearlyMembershipReward(
        subscription.userId,
        updatedSubscription.id,
        updatedSubscription.currentPeriodStart,
        updatedSubscription.plan,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Membership auto-renewal failed';

      await this.prisma.subscriptionInvoice.create({
        data: {
          userId: subscription.userId,
          planName: subscription.plan.name,
          amount: pricing.totalAmount,
          currency: pricing.totalCurrency,
          status: TransactionStatus.FAILED,
          failureReason: message,
          invoiceDate: new Date(),
        },
      });

      await this.prisma.userSubscription.update({
        where: { userId: subscription.userId },
        data: {
          status: SubscriptionStatus.PAUSED,
          isPaused: true,
          pausedAt: new Date(),
          isPaymentFailed: true,
        },
      });

      this.logger.warn(
        `Membership auto-renewal failed for user ${subscription.userId}: ${message}`,
      );
    }
  }

  private async awardYearlyMembershipReward(
    userId: string,
    subscriptionId: string,
    periodStart: Date,
    plan: {
      id: string;
      name: string;
      interval: SubscriptionInterval;
    },
  ) {
    if (plan.interval !== SubscriptionInterval.ANNUALLY) {
      return null;
    }

    return this.rewardsService.awardActivityReward({
      activityKey: 'MEMBERSHIP_YEARLY_SUBSCRIPTION',
      userId,
      sourceType: RewardLedgerSourceType.MANUAL_ADJUSTMENT,
      sourceId: `membership-yearly-${subscriptionId}-${periodStart.getTime()}`,
      defaultPoints: YEARLY_MEMBERSHIP_REWARD_POINTS,
      description: 'Subscribed to yearly membership plan',
      metadata: {
        planId: plan.id,
        planName: plan.name,
        interval: plan.interval,
        pointsReason: 'YEARLY_MEMBERSHIP_BONUS',
      },
      userRole: UserRole.PARENT,
    });
  }

  private async normalizeLifecycleState(subscription: any) {
    const now = new Date();

    if (
      subscription.status === SubscriptionStatus.FREE_TRIAL &&
      subscription.trialEndsAt &&
      subscription.trialEndsAt <= now
    ) {
      subscription = await this.prisma.userSubscription.update({
        where: { userId: subscription.userId },
        data: {
          status: SubscriptionStatus.EXPIRED,
          nextBillingDate: null,
        },
        include: { plan: true },
      });
    }

    if (
      subscription.status === SubscriptionStatus.CANCELLED &&
      subscription.accessEndsAt &&
      subscription.accessEndsAt <= now
    ) {
      subscription = await this.prisma.userSubscription.update({
        where: { userId: subscription.userId },
        data: {
          status: SubscriptionStatus.EXPIRED,
          isCancelled: true,
          nextBillingDate: null,
        },
        include: { plan: true },
      });
    }

    if (
      subscription.status === SubscriptionStatus.PAUSED &&
      subscription.resumeAt &&
      subscription.resumeAt <= now &&
      !subscription.isPaymentFailed
    ) {
      subscription = await this.prisma.userSubscription.update({
        where: { userId: subscription.userId },
        data: {
          status: SubscriptionStatus.ACTIVE,
          isPaused: false,
          pausedAt: null,
          resumeAt: null,
          pauseDurationWeeks: null,
        },
        include: { plan: true },
      });
    }

    return subscription;
  }
}
