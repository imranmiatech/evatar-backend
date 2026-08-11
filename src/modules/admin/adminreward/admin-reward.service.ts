import { Injectable } from '@nestjs/common';
import {
  Prisma,
  RewardLedgerEntryType,
  RewardOfferStatus,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

type RewardMetric = {
  key: string;
  label: string;
  value: number | string;
  formattedValue: string;
  currentMonthValue: number;
  previousMonthValue: number;
  changeValue: number;
  changePercent: number | null;
  changeLabel: string;
  changeDirection: 'up' | 'down' | 'flat';
  sparkline: number[];
};

@Injectable()
export class AdminRewardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const now = new Date();
    const currentMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const nextMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );
    const previousMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
    );

    const currentMonth = { gte: currentMonthStart, lt: nextMonthStart };
    const previousMonth = { gte: previousMonthStart, lt: currentMonthStart };

    const [
      totalIssued,
      totalRedeemed,
      activeRewardUsers,
      activeOffers,
      currentIssued,
      previousIssued,
      currentRedeemed,
      previousRedeemed,
      currentActiveRewardUsers,
      previousActiveRewardUsers,
      currentActiveOffers,
      previousActiveOffers,
      topOffer,
      currentTopOfferUses,
      previousTopOfferUses,
      recentActivity,
      issuedSparkline,
      redeemedSparkline,
      usersSparkline,
      offersSparkline,
      topOfferSparkline,
    ] = await Promise.all([
      this.issuedPoints(),
      this.redeemedPoints(),
      this.activeRewardUsers(),
      this.activeOffers(),
      this.issuedPoints(currentMonth),
      this.issuedPoints(previousMonth),
      this.redeemedPoints(currentMonth),
      this.redeemedPoints(previousMonth),
      this.activeRewardUsers(currentMonth),
      this.activeRewardUsers(previousMonth),
      this.activeOffers(currentMonth),
      this.activeOffers(previousMonth),
      this.mostRedeemedOffer(),
      this.redemptionUses(currentMonth),
      this.redemptionUses(previousMonth),
      this.getRecentActivity(8),
      this.monthlyDailySeries('issued', currentMonthStart, nextMonthStart),
      this.monthlyDailySeries('redeemed', currentMonthStart, nextMonthStart),
      this.monthlyDailySeries('users', currentMonthStart, nextMonthStart),
      this.monthlyDailySeries('offers', currentMonthStart, nextMonthStart),
      this.monthlyDailySeries('redemptions', currentMonthStart, nextMonthStart),
    ]);

    const metrics: RewardMetric[] = [
      this.metric({
        key: 'totalAlureiIssued',
        label: 'Total Alurei Issued',
        value: totalIssued,
        current: currentIssued,
        previous: previousIssued,
        sparkline: issuedSparkline,
      }),
      this.metric({
        key: 'totalAlureiRedeemed',
        label: 'Total Alurei Redeemed',
        value: totalRedeemed,
        current: currentRedeemed,
        previous: previousRedeemed,
        sparkline: redeemedSparkline,
      }),
      this.metric({
        key: 'activeRewardUsers',
        label: 'Active Reward Users',
        value: activeRewardUsers,
        current: currentActiveRewardUsers,
        previous: previousActiveRewardUsers,
        sparkline: usersSparkline,
      }),
      this.metric({
        key: 'activeOffers',
        label: 'Active Offers',
        value: activeOffers,
        current: currentActiveOffers,
        previous: previousActiveOffers,
        sparkline: offersSparkline,
      }),
      this.metric({
        key: 'mostRedeemedOffer',
        label: 'Most Redeemed Offer',
        value: topOffer?.name ?? 'N/A',
        current: currentTopOfferUses,
        previous: previousTopOfferUses,
        suffix: ' uses',
        sparkline: topOfferSparkline,
      }),
    ];

    return {
      success: true,
      message: 'Admin reward overview fetched successfully',
      data: {
        period: {
          currentMonthStart,
          nextMonthStart,
          previousMonthStart,
        },
        metrics,
        recentActivity,
      },
    };
  }

  async getRecentActivity(limit = 8) {
    const take = Math.min(Math.max(Number(limit) || 8, 1), 50);
    const now = new Date();

    const [ledgerEntries, redemptions] = await Promise.all([
      this.prisma.rewardLedgerEntry.findMany({
        include: { user: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
        take,
      }),
      this.prisma.rewardRedemption.findMany({
        include: {
          user: { select: { fullName: true } },
          offer: { select: { title: true, productName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
      }),
    ]);

    const activities = [
      ...ledgerEntries.map((entry) => {
        const isEarn = entry.entryType === RewardLedgerEntryType.EARN;
        return {
          id: `ledger-${entry.id}`,
          type: isEarn ? 'ALUREI_EARNED' : 'ALUREI_SPENT',
          icon: isEarn ? 'coins' : 'gift',
          color: isEarn ? 'green' : 'blue',
          title:
            entry.description ||
            `${entry.user.fullName} ${isEarn ? 'earned' : 'spent'} ${Math.abs(entry.points)} Alurei.`,
          subtitle: this.formatTimeAgo(entry.createdAt, now),
          userName: entry.user.fullName,
          points: entry.points,
          createdAt: entry.createdAt,
        };
      }),
      ...redemptions.map((redemption) => ({
        id: `redemption-${redemption.id}`,
        type: 'REWARD_REDEEMED',
        icon: 'voucher',
        color: 'orange',
        title: `${redemption.user.fullName} redeemed a ${
          redemption.offer.title || redemption.offer.productName
        }.`,
        subtitle: this.formatTimeAgo(redemption.createdAt, now),
        userName: redemption.user.fullName,
        points: -redemption.pointsSpent,
        createdAt: redemption.createdAt,
      })),
    ];

    return activities
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, take);
  }

  private async issuedPoints(createdAt?: Prisma.DateTimeFilter) {
    const result = await this.prisma.rewardLedgerEntry.aggregate({
      where: {
        entryType: RewardLedgerEntryType.EARN,
        ...(createdAt && { createdAt }),
      },
      _sum: { points: true },
    });

    return result._sum.points ?? 0;
  }

  private async redeemedPoints(createdAt?: Prisma.DateTimeFilter) {
    const result = await this.prisma.rewardRedemption.aggregate({
      where: { ...(createdAt && { createdAt }) },
      _sum: { pointsSpent: true },
    });

    return result._sum.pointsSpent ?? 0;
  }

  private async activeRewardUsers(createdAt?: Prisma.DateTimeFilter) {
    if (createdAt) {
      const [ledgerUsers, redemptionUsers] = await Promise.all([
        this.prisma.rewardLedgerEntry.findMany({
          where: { createdAt },
          select: { userId: true },
          distinct: ['userId'],
        }),
        this.prisma.rewardRedemption.findMany({
          where: { createdAt },
          select: { userId: true },
          distinct: ['userId'],
        }),
      ]);

      return new Set([
        ...ledgerUsers.map((item) => item.userId),
        ...redemptionUsers.map((item) => item.userId),
      ]).size;
    }

    return this.prisma.rewardAccount.count({
      where: {
        OR: [
          { balance: { gt: 0 } },
          { lifetimeEarned: { gt: 0 } },
          { lifetimeSpent: { gt: 0 } },
        ],
      },
    });
  }

  private async activeOffers(createdAt?: Prisma.DateTimeFilter) {
    return this.prisma.rewardOffer.count({
      where: {
        status: RewardOfferStatus.ACTIVE,
        ...(createdAt && { createdAt }),
      },
    });
  }

  private async mostRedeemedOffer() {
    const group = await this.prisma.rewardRedemption.groupBy({
      by: ['offerId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 1,
    });

    if (group.length === 0) return null;

    const offer = await this.prisma.rewardOffer.findUnique({
      where: { id: group[0].offerId },
      select: { title: true, productName: true },
    });

    return {
      name: offer?.title || offer?.productName || 'N/A',
      uses: group[0]._count.id,
    };
  }

  private async redemptionUses(createdAt: Prisma.DateTimeFilter) {
    return this.prisma.rewardRedemption.count({ where: { createdAt } });
  }

  private metric(input: {
    key: string;
    label: string;
    value: number | string;
    current: number;
    previous: number;
    suffix?: string;
    sparkline: number[];
  }): RewardMetric {
    const changeValue = input.current - input.previous;
    const changePercent = this.changePercent(input.current, input.previous);
    const changeDirection =
      changeValue > 0 ? 'up' : changeValue < 0 ? 'down' : 'flat';

    return {
      key: input.key,
      label: input.label,
      value: input.value,
      formattedValue:
        typeof input.value === 'number'
          ? input.value.toLocaleString()
          : input.value,
      currentMonthValue: input.current,
      previousMonthValue: input.previous,
      changeValue,
      changePercent,
      changeLabel: this.changeLabel(changePercent, changeValue, input.suffix),
      changeDirection,
      sparkline: input.sparkline,
    };
  }

  private changePercent(current: number, previous: number) {
    if (previous === 0) {
      return current === 0 ? 0 : null;
    }

    return Number((((current - previous) / previous) * 100).toFixed(1));
  }

  private changeLabel(
    changePercent: number | null,
    changeValue: number,
    suffix?: string,
  ) {
    if (changePercent !== null) {
      if (changePercent === 0) return '0%';
      return `${changePercent > 0 ? '+' : ''}${changePercent}%`;
    }

    if (changeValue === 0) return '0';
    return `${changeValue > 0 ? '+' : ''}${changeValue.toLocaleString()}${suffix ?? ''}`;
  }

  private async monthlyDailySeries(
    kind: 'issued' | 'redeemed' | 'users' | 'offers' | 'redemptions',
    start: Date,
    end: Date,
  ) {
    const days = Math.max(
      1,
      Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)),
    );
    const series = Array.from({ length: days }, () => 0);

    if (kind === 'issued') {
      const rows = await this.prisma.rewardLedgerEntry.findMany({
        where: {
          entryType: RewardLedgerEntryType.EARN,
          createdAt: { gte: start, lt: end },
        },
        select: { points: true, createdAt: true },
      });
      rows.forEach((row) => {
        series[this.dayIndex(row.createdAt, start)] += row.points;
      });
      return series;
    }

    if (kind === 'redeemed') {
      const rows = await this.prisma.rewardRedemption.findMany({
        where: { createdAt: { gte: start, lt: end } },
        select: { pointsSpent: true, createdAt: true },
      });
      rows.forEach((row) => {
        series[this.dayIndex(row.createdAt, start)] += row.pointsSpent;
      });
      return series;
    }

    if (kind === 'users') {
      const rows = await this.prisma.rewardLedgerEntry.findMany({
        where: { createdAt: { gte: start, lt: end } },
        select: { userId: true, createdAt: true },
      });
      const usersByDay = new Map<number, Set<string>>();
      rows.forEach((row) => {
        const index = this.dayIndex(row.createdAt, start);
        usersByDay.set(index, usersByDay.get(index) ?? new Set());
        usersByDay.get(index)!.add(row.userId);
      });
      usersByDay.forEach((users, index) => {
        series[index] = users.size;
      });
      return series;
    }

    if (kind === 'offers') {
      const rows = await this.prisma.rewardOffer.findMany({
        where: {
          status: RewardOfferStatus.ACTIVE,
          createdAt: { gte: start, lt: end },
        },
        select: { createdAt: true },
      });
      rows.forEach((row) => {
        series[this.dayIndex(row.createdAt, start)] += 1;
      });
      return series;
    }

    const rows = await this.prisma.rewardRedemption.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { createdAt: true },
    });
    rows.forEach((row) => {
      series[this.dayIndex(row.createdAt, start)] += 1;
    });
    return series;
  }

  private dayIndex(date: Date, start: Date) {
    return Math.min(
      Math.max(
        Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)),
        0,
      ),
      30,
    );
  }

  private formatTimeAgo(date: Date, now: Date): string {
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(Math.max(0, diffMs) / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }
}
