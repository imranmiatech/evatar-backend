import { Injectable } from '@nestjs/common';
import {
  SubscriptionInterval,
  SubscriptionStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

type MembershipBucketKey = 'free' | 'monthly' | 'yearly' | 'global';

type MembershipMetric = {
  key: string;
  label: string;
  value: number;
  formattedValue: string;
  currentValue: number;
  previousValue: number;
  changeValue: number;
  changePercent: number | null;
  changeLabel: string;
  changeDirection: 'up' | 'down' | 'flat';
  sparkline: number[];
};

type MembershipBucketSnapshot = {
  key: MembershipBucketKey;
  label: string;
  color: string;
  families: number;
  monthlyRevenue: number;
};

type MembershipSnapshot = {
  capturedAt: Date;
  totalFamilies: number;
  activeMemberships: number;
  familiesOnTrial: number;
  monthlyRevenueEquivalent: number;
  avgRevenuePerFamily: number;
  buckets: Record<MembershipBucketKey, MembershipBucketSnapshot>;
};

@Injectable()
export class AdminMembershipService {
  private readonly baseCurrency = (
    process.env.ADMIN_MEMBERSHIP_DASHBOARD_CURRENCY || 'AED'
  ).toUpperCase();

  private readonly exchangeRatesToAed: Record<string, number> = {
    AED: 1,
    USD: 3.67,
    EUR: 4,
  };

  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const [overview, distribution] = await Promise.all([
      this.getOverview(),
      this.getDistribution(),
    ]);

    const cards = overview.data.metrics.map((metric) => ({
      key: metric.key,
      label: metric.label,
      value: metric.value,
      formattedValue: metric.formattedValue,
      trendLabel: metric.changeLabel,
      trendDirection: metric.changeDirection,
      sparkline: metric.sparkline,
    }));

    const membershipDistribution = {
      title: 'Membership Distribution',
      totalFamilies: distribution.data.totalFamilies,
      donutSegments: distribution.data.chart.map((item) => ({
        key: item.key,
        label: item.label,
        value: item.families,
        color: item.color,
        percentage: item.percentage,
      })),
      rows: distribution.data.chart.map((item) => ({
        key: item.key,
        label: item.label,
        color: item.color,
        families: item.families,
        familiesLabel: `${item.families} families`,
        monthlyRevenue: item.monthlyRevenue,
        monthlyRevenueLabel: `${item.formattedMonthlyRevenue}/mo`,
        percentage: item.percentage,
      })),
    };

    return {
      success: true,
      message: 'Admin membership dashboard fetched successfully',
      data: {
        cards,
        membershipDistribution,
        overview: overview.data,
        distribution: distribution.data,
      },
    };
  }

  async getOverview() {
    const now = new Date();
    const previousMonthReference = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, now.getUTCDate()),
    );

    const [currentSnapshot, previousSnapshot] = await Promise.all([
      this.buildSnapshot(now),
      this.buildSnapshot(previousMonthReference),
    ]);

    const metrics: MembershipMetric[] = [
      this.metric(
        'activeMemberships',
        'Active Memberships',
        currentSnapshot.activeMemberships,
        previousSnapshot.activeMemberships,
      ),
      this.metric(
        'familiesOnTrial',
        'Families on Trial',
        currentSnapshot.familiesOnTrial,
        previousSnapshot.familiesOnTrial,
      ),
      this.metric(
        'avgRevenuePerFamily',
        'Avg Revenue per Family',
        currentSnapshot.avgRevenuePerFamily,
        previousSnapshot.avgRevenuePerFamily,
        {
          currency: this.baseCurrency,
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        },
      ),
    ];

    return {
      success: true,
      message: 'Admin membership overview fetched successfully',
      data: {
        currency: this.baseCurrency,
        generatedAt: now,
        metrics,
      },
    };
  }

  async getDistribution() {
    const snapshot = await this.buildSnapshot(new Date());
    const chart = this.bucketOrder().map((key) => {
      const bucket = snapshot.buckets[key];
      const share =
        snapshot.totalFamilies > 0
          ? (bucket.families / snapshot.totalFamilies) * 100
          : 0;

      return {
        key: bucket.key,
        label: bucket.label,
        color: bucket.color,
        families: bucket.families,
        percentage: Number(share.toFixed(1)),
        monthlyRevenue: Number(bucket.monthlyRevenue.toFixed(2)),
        formattedMonthlyRevenue: this.formatCurrency(bucket.monthlyRevenue),
      };
    });

    return {
      success: true,
      message: 'Admin membership distribution fetched successfully',
      data: {
        currency: this.baseCurrency,
        totalFamilies: snapshot.totalFamilies,
        activeMemberships: snapshot.activeMemberships,
        familiesOnTrial: snapshot.familiesOnTrial,
        chart,
      },
    };
  }

  private async buildSnapshot(
    referenceDate: Date,
  ): Promise<MembershipSnapshot> {
    const parents = await this.prisma.user.findMany({
      where: {
        role: UserRole.PARENT,
        createdAt: { lte: referenceDate },
      },
      select: {
        id: true,
        createdAt: true,
        userSubscription: {
          select: {
            createdAt: true,
            status: true,
            trialEndsAt: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            accessEndsAt: true,
            isCancelled: true,
            plan: {
              select: {
                name: true,
                price: true,
                currency: true,
                interval: true,
              },
            },
          },
        },
      },
    });

    const buckets = this.createBuckets();

    for (const parent of parents) {
      const subscription = parent.userSubscription;
      const bucketKey = this.resolveBucket(subscription, referenceDate);
      const bucket = buckets[bucketKey];
      bucket.families += 1;

      if (bucketKey === 'free') {
        continue;
      }

      if (subscription?.plan) {
        bucket.monthlyRevenue += this.toMonthlyBaseRevenue(
          Number(subscription.plan.price || 0),
          subscription.plan.currency || this.baseCurrency,
          subscription.plan.interval,
        );
      }
    }

    const activeMemberships =
      buckets.monthly.families +
      buckets.yearly.families +
      buckets.global.families;
    const familiesOnTrial = parents.filter((parent) =>
      this.isTrialFamily(parent.userSubscription, referenceDate),
    ).length;
    const monthlyRevenueEquivalent =
      buckets.monthly.monthlyRevenue +
      buckets.yearly.monthlyRevenue +
      buckets.global.monthlyRevenue;

    return {
      capturedAt: referenceDate,
      totalFamilies: parents.length,
      activeMemberships,
      familiesOnTrial,
      monthlyRevenueEquivalent: Number(monthlyRevenueEquivalent.toFixed(2)),
      avgRevenuePerFamily:
        activeMemberships > 0
          ? Number((monthlyRevenueEquivalent / activeMemberships).toFixed(2))
          : 0,
      buckets,
    };
  }

  private resolveBucket(
    subscription: {
      createdAt: Date;
      status: SubscriptionStatus;
      trialEndsAt: Date | null;
      currentPeriodStart: Date;
      currentPeriodEnd: Date;
      accessEndsAt: Date | null;
      isCancelled: boolean;
      plan: {
        name: string;
        interval: SubscriptionInterval;
      } | null;
    } | null,
    referenceDate: Date,
  ): MembershipBucketKey {
    if (!subscription?.plan) {
      return 'free';
    }

    if (this.isTrialFamily(subscription, referenceDate)) {
      return 'free';
    }

    if (!this.hasPaidAccess(subscription, referenceDate)) {
      return 'free';
    }

    const normalizedName = subscription.plan.name.trim().toLowerCase();
    if (normalizedName.includes('global')) {
      return 'global';
    }

    if (
      normalizedName.includes('yearly') ||
      subscription.plan.interval === SubscriptionInterval.ANNUALLY
    ) {
      return 'yearly';
    }

    return 'monthly';
  }

  private hasPaidAccess(
    subscription: {
      status: SubscriptionStatus;
      trialEndsAt: Date | null;
      currentPeriodStart: Date;
      currentPeriodEnd: Date;
      accessEndsAt: Date | null;
      isCancelled: boolean;
    },
    referenceDate: Date,
  ) {
    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      return false;
    }

    if (subscription.currentPeriodStart > referenceDate) {
      return false;
    }

    if (subscription.trialEndsAt && subscription.trialEndsAt > referenceDate) {
      return false;
    }

    if (subscription.isCancelled && subscription.accessEndsAt) {
      return subscription.accessEndsAt > referenceDate;
    }

    return (
      subscription.currentPeriodEnd > referenceDate ||
      !subscription.accessEndsAt ||
      subscription.accessEndsAt > referenceDate
    );
  }

  private isTrialFamily(
    subscription: {
      status: SubscriptionStatus;
      trialEndsAt: Date | null;
      createdAt: Date;
    } | null,
    referenceDate: Date,
  ) {
    if (!subscription || subscription.createdAt > referenceDate) {
      return false;
    }

    return (
      subscription.status === SubscriptionStatus.FREE_TRIAL &&
      !!subscription.trialEndsAt &&
      subscription.trialEndsAt > referenceDate
    );
  }

  private createBuckets(): Record<
    MembershipBucketKey,
    MembershipBucketSnapshot
  > {
    return {
      free: {
        key: 'free',
        label: 'Free',
        color: '#64748B',
        families: 0,
        monthlyRevenue: 0,
      },
      monthly: {
        key: 'monthly',
        label: 'Monthly',
        color: '#0EA5E9',
        families: 0,
        monthlyRevenue: 0,
      },
      yearly: {
        key: 'yearly',
        label: 'Yearly',
        color: '#7C3AED',
        families: 0,
        monthlyRevenue: 0,
      },
      global: {
        key: 'global',
        label: 'Global',
        color: '#D97706',
        families: 0,
        monthlyRevenue: 0,
      },
    };
  }

  private bucketOrder(): MembershipBucketKey[] {
    return ['free', 'monthly', 'yearly', 'global'];
  }

  private toMonthlyBaseRevenue(
    amount: number,
    currency: string,
    interval: SubscriptionInterval,
  ) {
    const monthlyAmount =
      interval === SubscriptionInterval.ANNUALLY ? amount / 12 : amount;

    return this.convertCurrency(monthlyAmount, currency, this.baseCurrency);
  }

  private convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ) {
    const normalizedFrom = (fromCurrency || this.baseCurrency).toUpperCase();
    const normalizedTo = (toCurrency || this.baseCurrency).toUpperCase();
    const fromRate = this.exchangeRatesToAed[normalizedFrom] ?? 1;
    const toRate = this.exchangeRatesToAed[normalizedTo] ?? 1;
    const amountInAed = amount * fromRate;

    return amountInAed / toRate;
  }

  private metric(
    key: string,
    label: string,
    current: number,
    previous: number,
    options?: {
      currency?: string;
      minimumFractionDigits?: number;
      maximumFractionDigits?: number;
    },
  ): MembershipMetric {
    const changeValue = current - previous;
    const changePercent =
      previous > 0 ? Number(((changeValue / previous) * 100).toFixed(1)) : null;

    return {
      key,
      label,
      value: Number(current.toFixed(options?.maximumFractionDigits ?? 2)),
      formattedValue: options?.currency
        ? this.formatCurrency(current, options.currency, options)
        : this.formatNumber(current, options),
      currentValue: current,
      previousValue: previous,
      changeValue: Number(changeValue.toFixed(2)),
      changePercent,
      changeLabel:
        changePercent === null
          ? 'New'
          : `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%`,
      changeDirection:
        changeValue > 0 ? 'up' : changeValue < 0 ? 'down' : 'flat',
      sparkline: this.sparkline(current, previous),
    };
  }

  private sparkline(current: number, previous: number) {
    if (previous === 0 && current === 0) {
      return [0, 0, 0, 0, 0, 0];
    }

    if (previous === 0) {
      const step = current / 6;
      return Array.from({ length: 6 }, (_, index) =>
        Number((step * (index + 1)).toFixed(2)),
      );
    }

    return [
      Number((previous * 0.96).toFixed(2)),
      Number((previous * 0.99).toFixed(2)),
      Number((((previous + current) / 2) * 0.98).toFixed(2)),
      Number((((previous + current) / 2) * 1.01).toFixed(2)),
      Number((current * 0.99).toFixed(2)),
      Number(current.toFixed(2)),
    ];
  }

  private formatCurrency(
    amount: number,
    currency = this.baseCurrency,
    options?: {
      minimumFractionDigits?: number;
      maximumFractionDigits?: number;
    },
  ) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: options?.minimumFractionDigits ?? 0,
      maximumFractionDigits: options?.maximumFractionDigits ?? 0,
    }).format(amount);
  }

  private formatNumber(
    value: number,
    options?: {
      minimumFractionDigits?: number;
      maximumFractionDigits?: number;
    },
  ) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: options?.minimumFractionDigits ?? 0,
      maximumFractionDigits: options?.maximumFractionDigits ?? 0,
    }).format(value);
  }
}
