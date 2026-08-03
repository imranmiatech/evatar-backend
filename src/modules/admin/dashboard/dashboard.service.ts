import { Injectable } from '@nestjs/common';
import {
  Prisma,
  RewardLedgerEntryType,
  RewardRedemptionStatus,
  SupportTicketStatus,
  TransactionStatus,
  UserRole,
  UserStatus,
  VerificationStatus,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  UserGrowthQueryDto,
  UserGrowthPeriod,
  UserGrowthChartPoint,
} from './dto/user-growth-query.dto';
import {
  RecentActivityQueryDto,
  RecentActivityItem,
} from './dto/recent-activity-query.dto';

type MetricKey =
  | 'families'
  | 'children'
  | 'verifiedNannies'
  | 'activeMembers'
  | 'partnerStores'
  | 'monthlyRevenue'
  | 'supportTickets';

@Injectable()
export class DashboardService {
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

    const currentMonthWhere = {
      gte: currentMonthStart,
      lt: nextMonthStart,
    };
    const previousMonthWhere = {
      gte: previousMonthStart,
      lt: currentMonthStart,
    };

    const unresolvedTicketWhere = {
      status: {
        not: SupportTicketStatus.RESOLVED,
      },
    };

    const [
      families,
      children,
      verifiedNannies,
      activeMembers,
      partnerStores,
      monthlyRevenue,
      supportTickets,
      previousFamilies,
      previousChildren,
      previousVerifiedNannies,
      previousActiveMembers,
      previousPartnerStores,
      previousMonthlyRevenue,
      previousSupportTickets,
    ] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { role: UserRole.PARENT } }),
      this.prisma.child.count(),
      this.prisma.user.count({
        where: {
          role: UserRole.NANNY,
          verificationStatus: VerificationStatus.APPROVED,
        },
      }),
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.store.count(),
      this.prisma.transaction.aggregate({
        where: {
          status: TransactionStatus.SUCCESS,
          createdAt: currentMonthWhere,
        },
        _sum: { amount: true },
      }),
      this.prisma.supportTicket.count({ where: unresolvedTicketWhere }),
      this.prisma.user.count({
        where: { role: UserRole.PARENT, createdAt: previousMonthWhere },
      }),
      this.prisma.child.count({
        where: { createdAt: previousMonthWhere },
      }),
      this.prisma.user.count({
        where: {
          role: UserRole.NANNY,
          verificationStatus: VerificationStatus.APPROVED,
          createdAt: previousMonthWhere,
        },
      }),
      this.prisma.user.count({
        where: { status: UserStatus.ACTIVE, createdAt: previousMonthWhere },
      }),
      this.prisma.store.count({
        where: { createdAt: previousMonthWhere },
      }),
      this.prisma.transaction.aggregate({
        where: {
          status: TransactionStatus.SUCCESS,
          createdAt: previousMonthWhere,
        },
        _sum: { amount: true },
      }),
      this.prisma.supportTicket.count({
        where: {
          ...unresolvedTicketWhere,
          createdAt: previousMonthWhere,
        },
      }),
    ]);

    const currentMonthNew = await this.currentMonthNewCounts(
      currentMonthWhere,
    );
    const revenue = monthlyRevenue._sum.amount ?? 0;
    const previousRevenue = previousMonthlyRevenue._sum.amount ?? 0;

    const metrics = {
      families: this.metric('families', families, currentMonthNew.families, previousFamilies),
      children: this.metric('children', children, currentMonthNew.children, previousChildren),
      verifiedNannies: this.metric(
        'verifiedNannies',
        verifiedNannies,
        currentMonthNew.verifiedNannies,
        previousVerifiedNannies,
      ),
      activeMembers: this.metric(
        'activeMembers',
        activeMembers,
        currentMonthNew.activeMembers,
        previousActiveMembers,
      ),
      partnerStores: this.metric(
        'partnerStores',
        partnerStores,
        currentMonthNew.partnerStores,
        previousPartnerStores,
      ),
      monthlyRevenue: this.metric(
        'monthlyRevenue',
        revenue,
        revenue,
        previousRevenue,
      ),
      supportTickets: this.metric(
        'supportTickets',
        supportTickets,
        currentMonthNew.supportTickets,
        previousSupportTickets,
      ),
    };

    return {
      message: 'Admin dashboard overview fetched successfully',
      data: {
        period: {
          currentMonthStart,
          nextMonthStart,
          previousMonthStart,
        },
        metrics,
        cards: [
          this.card('Families', metrics.families),
          this.card('Children', metrics.children),
          this.card('Verified Nannies', metrics.verifiedNannies),
          this.card('Active Members', metrics.activeMembers),
          this.card('Partner Stores', metrics.partnerStores),
          this.card('Monthly Revenue', metrics.monthlyRevenue),
          this.card('Support Tickets', metrics.supportTickets),
        ],
      },
    };
  }

  async getRewardsOverview() {
    const now = new Date();
    const currentMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const nextMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );

    const dateFilter = {
      gte: currentMonthStart,
      lt: nextMonthStart,
    };

    const [
      issuedSum,
      redeemedSum,
      pendingCount,
      topPartnerGroup,
      topOfferGroup,
      totalRedemptions,
      usedRedemptions,
    ] = await Promise.all([
      this.prisma.rewardLedgerEntry.aggregate({
        where: {
          entryType: RewardLedgerEntryType.EARN,
          createdAt: dateFilter,
        },
        _sum: { points: true },
      }),
      this.prisma.rewardRedemption.aggregate({
        where: {
          createdAt: dateFilter,
        },
        _sum: { pointsSpent: true },
      }),
      this.prisma.rewardRedemption.count({
        where: {
          status: RewardRedemptionStatus.ACTIVE,
          createdAt: dateFilter,
        },
      }),
      this.prisma.rewardRedemption.groupBy({
        by: ['offerId'],
        where: { createdAt: dateFilter },
        _count: { offerId: true },
        orderBy: { _count: { offerId: 'desc' } },
        take: 1,
      }),
      this.prisma.rewardRedemption.groupBy({
        by: ['offerId'],
        where: { createdAt: dateFilter },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 1,
      }),
      this.prisma.rewardRedemption.count({
        where: { createdAt: dateFilter },
      }),
      this.prisma.rewardRedemption.count({
        where: {
          status: RewardRedemptionStatus.USED,
          createdAt: dateFilter,
        },
      }),
    ]);

    const aureisIssued = issuedSum._sum.points ?? 0;
    const pointsRedeemed = redeemedSum._sum.pointsSpent ?? 0;

    let topPartnerName = 'N/A';
    if (topPartnerGroup.length > 0) {
      const offer = await this.prisma.rewardOffer.findUnique({
        where: { id: topPartnerGroup[0].offerId },
        include: {
          partnerUser: { select: { fullName: true } },
          store: { select: { name: true } },
        },
      });
      topPartnerName =
        offer?.store?.name || offer?.partnerUser?.fullName || 'N/A';
    }

    let mostPopularOfferTitle = 'N/A';
    if (topOfferGroup.length > 0) {
      const offer = await this.prisma.rewardOffer.findUnique({
        where: { id: topOfferGroup[0].offerId },
        select: { title: true, productName: true },
      });
      mostPopularOfferTitle = offer?.title || offer?.productName || 'N/A';
    }

    const redemptionRate =
      aureisIssued > 0
        ? Number(((pointsRedeemed / aureisIssued) * 100).toFixed(1))
        : totalRedemptions > 0
        ? Number(((usedRedemptions / totalRedemptions) * 100).toFixed(1))
        : 0;

    return {
      message: 'Admin rewards overview fetched successfully',
      data: {
        period: {
          currentMonthStart,
          nextMonthStart,
        },
        overview: {
          aureisIssued: {
            label: 'Alureis Issued',
            value: aureisIssued,
            formattedValue: aureisIssued.toLocaleString(),
          },
          redeemed: {
            label: 'Redeemed',
            value: pointsRedeemed,
            formattedValue: pointsRedeemed.toLocaleString(),
          },
          pendingRedemptions: {
            label: 'Pending Redemptions',
            value: pendingCount,
            formattedValue: pendingCount.toLocaleString(),
          },
          topPartner: {
            label: 'Top Partner',
            value: topPartnerName,
          },
          mostPopularOffer: {
            label: 'Most Popular Offer',
            value: mostPopularOfferTitle,
          },
          redemptionRate: {
            label: 'Redemption Rate',
            value: redemptionRate,
            formattedValue: `${redemptionRate}%`,
          },
        },
      },
    };
  }

  async getUserGrowth(query: UserGrowthQueryDto) {
    const period = query.period || UserGrowthPeriod.D30;
    const roleWhere = query.role ? { role: query.role } : {};

    const now = new Date();
    const endDate = new Date(now);

    let startDate: Date;
    let isMonthly = false;

    if (period === UserGrowthPeriod.D7) {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === UserGrowthPeriod.D90) {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 89);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === UserGrowthPeriod.M12) {
      isMonthly = true;
      startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1, 0, 0, 0, 0);
    } else {
      // Default: 30D
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 29);
      startDate.setHours(0, 0, 0, 0);
    }

    const initialUsersCount = await this.prisma.user.count({
      where: {
        ...roleWhere,
        createdAt: { lt: startDate },
      },
    });

    const usersInPeriod = await this.prisma.user.findMany({
      where: {
        ...roleWhere,
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    const chartData: UserGrowthChartPoint[] = [];
    let runningTotal = initialUsersCount;

    if (isMonthly) {
      for (let i = 0; i < 12; i++) {
        const slotStart = new Date(
          startDate.getFullYear(),
          startDate.getMonth() + i,
          1,
        );
        const slotEnd = new Date(
          startDate.getFullYear(),
          startDate.getMonth() + i + 1,
          0,
          23,
          59,
          59,
          999,
        );

        if (slotStart > now) break;

        const actualEnd = slotEnd > now ? now : slotEnd;

        const newUsers = usersInPeriod.filter(
          (u) => u.createdAt >= slotStart && u.createdAt <= actualEnd,
        ).length;

        runningTotal += newUsers;

        const label = `${monthNames[slotStart.getMonth()]} ${slotStart.getFullYear()}`;
        const dateStr = slotStart.toISOString().split('T')[0];

        chartData.push({
          label,
          date: dateStr,
          newUsers,
          totalUsers: runningTotal,
        });
      }
    } else {
      const daysCount =
        period === UserGrowthPeriod.D7
          ? 7
          : period === UserGrowthPeriod.D90
          ? 90
          : 30;

      for (let i = 0; i < daysCount; i++) {
        const slotStart = new Date(startDate);
        slotStart.setDate(startDate.getDate() + i);
        slotStart.setHours(0, 0, 0, 0);

        const slotEnd = new Date(slotStart);
        slotEnd.setHours(23, 59, 59, 999);

        if (slotStart > now) break;

        const actualEnd = slotEnd > now ? now : slotEnd;

        const newUsers = usersInPeriod.filter(
          (u) => u.createdAt >= slotStart && u.createdAt <= actualEnd,
        ).length;

        runningTotal += newUsers;

        const label = `${monthNames[slotStart.getMonth()]} ${slotStart.getDate()}`;
        const dateStr = slotStart.toISOString().split('T')[0];

        chartData.push({
          label,
          date: dateStr,
          newUsers,
          totalUsers: runningTotal,
        });
      }
    }

    const periodNewUsers = usersInPeriod.length;
    const totalUsers = runningTotal;
    const growthRate =
      initialUsersCount > 0
        ? Number(((periodNewUsers / initialUsersCount) * 100).toFixed(1))
        : periodNewUsers > 0
        ? 100
        : 0;

    return {
      message: 'User growth data fetched successfully',
      data: {
        period,
        roleFilter: query.role || 'ALL',
        startDate,
        endDate: now,
        summary: {
          totalUsers,
          periodNewUsers,
          initialUsersBeforePeriod: initialUsersCount,
          growthRatePercent: growthRate,
        },
        chartData,
      },
    };
  }

  async getRecentActivities(query: RecentActivityQueryDto) {
    const limit = query.limit || 10;
    const now = new Date();

    const [
      recentParents,
      recentNannies,
      recentPartners,
      recentTickets,
      recentOffers,
      recentRedemptions,
      recentTransactions,
      recentStories,
      recentDayPlans,
    ] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: UserRole.PARENT },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.user.findMany({
        where: {
          role: UserRole.NANNY,
          verificationStatus: VerificationStatus.APPROVED,
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),
      this.prisma.user.findMany({
        where: { role: UserRole.PARTNER },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.supportTicket.findMany({
        include: { user: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.rewardOffer.findMany({
        include: {
          partnerUser: { select: { fullName: true } },
          store: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.rewardRedemption.findMany({
        include: {
          offer: { select: { title: true } },
          user: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.transaction.findMany({
        include: { user: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.bedtimeStory.findMany({
        include: {
          dayPlan: {
            include: {
              child: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.dayPlan.findMany({
        include: {
          child: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    const items: Array<{
      id: string;
      type: string;
      color: 'green' | 'purple' | 'blue' | 'orange' | 'red' | 'yellow';
      title: string;
      subtitle: string;
      date: Date;
    }> = [];

    recentParents.forEach((p) => {
      items.push({
        id: `parent-${p.id}`,
        type: 'FAMILY_REGISTERED',
        color: 'green',
        title: 'New family registered',
        subtitle: `The ${p.fullName} Family`,
        date: p.createdAt,
      });
    });

    recentNannies.forEach((n) => {
      items.push({
        id: `nanny-${n.id}`,
        type: 'NANNY_VERIFIED',
        color: 'blue',
        title: 'Nanny verified',
        subtitle: n.fullName,
        date: n.updatedAt || n.createdAt,
      });
    });

    recentPartners.forEach((pt) => {
      items.push({
        id: `partner-${pt.id}`,
        type: 'PARTNER_APPROVED',
        color: 'orange',
        title: 'Partner approved',
        subtitle: pt.fullName,
        date: pt.createdAt,
      });
    });

    recentTickets.forEach((t) => {
      items.push({
        id: `ticket-${t.id}`,
        type: 'SUPPORT_TICKET_OPENED',
        color: 'red',
        title: 'Support ticket opened',
        subtitle: `${t.subject} #${t.id.slice(0, 6).toUpperCase()}`,
        date: t.createdAt,
      });
    });

    recentOffers.forEach((o) => {
      items.push({
        id: `offer-${o.id}`,
        type: 'GROCERY_ITEM_ADDED',
        color: 'yellow',
        title: 'Grocery item added',
        subtitle: `${o.productName || o.title} by ${o.store?.name || o.partnerUser?.fullName || 'Partner'}`,
        date: o.createdAt,
      });
    });

    recentRedemptions.forEach((r) => {
      items.push({
        id: `redemption-${r.id}`,
        type: 'REWARD_REDEMPTION_CREATED',
        color: 'green',
        title: 'Reward offer redeemed',
        subtitle: `${r.offer?.title || 'Offer'} redeemed by ${r.user?.fullName || 'User'}`,
        date: r.createdAt,
      });
    });

    recentTransactions.forEach((tx) => {
      items.push({
        id: `tx-${tx.id}`,
        type: 'SUBSCRIPTION_UPGRADED',
        color: 'green',
        title: 'Subscription upgraded',
        subtitle: `${tx.user?.fullName || 'User'} Family → Premium`,
        date: tx.createdAt,
      });
    });

    recentStories.forEach((st) => {
      items.push({
        id: `story-${st.id}`,
        type: 'AI_STORY_GENERATED',
        color: 'purple',
        title: 'AI Story generated',
        subtitle: `${st.title} for ${st.dayPlan?.child?.name || 'Child'}`,
        date: st.createdAt,
      });
    });

    recentDayPlans.forEach((dp) => {
      items.push({
        id: `dayplan-${dp.id}`,
        type: 'DAY_PLAN_CREATED',
        color: 'purple',
        title: 'Day plan generated',
        subtitle: `${dp.title || 'Child Activity Plan'} for ${dp.child?.name || 'Child'}`,
        date: dp.createdAt,
      });
    });

    items.sort((a, b) => b.date.getTime() - a.date.getTime());

    const result: RecentActivityItem[] = items.slice(0, limit).map((item) => ({
      id: item.id,
      type: item.type,
      color: item.color,
      title: item.title,
      subtitle: item.subtitle,
      timestamp: item.date.toISOString(),
      timeAgo: this.formatTimeAgo(item.date, now),
    }));

    return {
      message: 'Recent activities fetched successfully from database',
      data: {
        total: result.length,
        activities: result,
      },
    };
  }

  private formatTimeAgo(date: Date, now: Date): string {
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.max(0, Math.floor(diffMs / 1000));
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24)
      return `${diffHours} ${diffHours === 1 ? 'hr' : 'hrs'} ago`;
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  }

  private async currentMonthNewCounts(
    currentMonthWhere: Prisma.DateTimeFilter,
  ) {
    const [
      families,
      children,
      verifiedNannies,
      activeMembers,
      partnerStores,
      supportTickets,
    ] = await this.prisma.$transaction([
      this.prisma.user.count({
        where: { role: UserRole.PARENT, createdAt: currentMonthWhere },
      }),
      this.prisma.child.count({ where: { createdAt: currentMonthWhere } }),
      this.prisma.user.count({
        where: {
          role: UserRole.NANNY,
          verificationStatus: VerificationStatus.APPROVED,
          createdAt: currentMonthWhere,
        },
      }),
      this.prisma.user.count({
        where: { status: UserStatus.ACTIVE, createdAt: currentMonthWhere },
      }),
      this.prisma.store.count({ where: { createdAt: currentMonthWhere } }),
      this.prisma.supportTicket.count({
        where: {
          status: { not: SupportTicketStatus.RESOLVED },
          createdAt: currentMonthWhere,
        },
      }),
    ]);

    return {
      families,
      children,
      verifiedNannies,
      activeMembers,
      partnerStores,
      supportTickets,
    };
  }

  private metric(
    key: MetricKey,
    value: number,
    currentPeriodValue: number,
    previousPeriodValue: number,
  ) {
    return {
      key,
      value,
      currentPeriodValue,
      previousPeriodValue,
      changePercent: this.changePercent(
        currentPeriodValue,
        previousPeriodValue,
      ),
    };
  }

  private card(label: string, metric: ReturnType<DashboardService['metric']>) {
    return {
      key: metric.key,
      label,
      value: metric.value,
      changePercent: metric.changePercent,
    };
  }

  private changePercent(current: number, previous: number) {
    if (previous === 0) {
      return current === 0 ? 0 : null;
    }

    return Number((((current - previous) / previous) * 100).toFixed(1));
  }
}
