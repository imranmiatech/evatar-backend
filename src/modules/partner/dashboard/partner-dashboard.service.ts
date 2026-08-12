import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PartnerOfferStatus, Prisma, UserRole } from '@prisma/client';
import type { CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { PartnerDashboardRangeQueryDto } from './dto/partner-dashboard-query.dto';

type DashboardRange = '7D' | '30D' | '3M';

@Injectable()
export class PartnerDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(
    user: CurrentUserPayload,
    query: PartnerDashboardRangeQueryDto,
  ) {
    this.ensurePartner(user);
    const partnerUserId = this.currentUserId(user);
    const [
      profile,
      cards,
      offerPerformance,
      recentActivity,
      topPerformingOffer,
    ] = await Promise.all([
      this.getPartnerProfile(partnerUserId),
      this.getCards(partnerUserId),
      this.getPerformance(user, query),
      this.getRecentActivity(user),
      this.getTopOffer(user),
    ]);

    return {
      success: true,
      message: 'Partner dashboard fetched successfully',
      data: {
        greeting: this.greeting(),
        displayName:
          profile?.partnerProfile?.businessName ||
          profile?.fullName ||
          'Partner',
        cards,
        offerPerformance: offerPerformance.data,
        recentActivity: recentActivity.data,
        topPerformingOffer: topPerformingOffer.data,
      },
    };
  }

  async getPerformance(
    user: CurrentUserPayload,
    query: PartnerDashboardRangeQueryDto,
  ) {
    this.ensurePartner(user);
    const partnerUserId = this.currentUserId(user);
    const range = query.range ?? '7D';
    const buckets = this.makeBuckets(range);
    const offerWhere = { partnerUserId };
    const eventWhere = {
      offer: offerWhere,
      createdAt: { gte: buckets[0].start, lt: buckets[buckets.length - 1].end },
    };

    const [views, saves, redemptions] = await Promise.all([
      this.prisma.partnerOfferView.findMany({
        where: eventWhere,
        select: { createdAt: true },
      }),
      this.prisma.partnerOfferSave.findMany({
        where: eventWhere,
        select: { createdAt: true },
      }),
      this.prisma.partnerOfferRedemption.findMany({
        where: eventWhere,
        select: { createdAt: true },
      }),
    ]);

    return {
      success: true,
      message: 'Partner offer performance fetched successfully',
      data: {
        range,
        labels: buckets.map((bucket) => bucket.label),
        series: {
          redemptions: this.countByBucket(redemptions, buckets),
          saves: this.countByBucket(saves, buckets),
          views: this.countByBucket(views, buckets),
        },
      },
    };
  }

  async getTopOffer(user: CurrentUserPayload) {
    this.ensurePartner(user);
    const partnerUserId = this.currentUserId(user);
    const offers = await this.prisma.partnerOffer.findMany({
      where: { partnerUserId },
      include: {
        _count: {
          select: {
            views: true,
            saves: true,
            redemptions: true,
          },
        },
      },
    });

    const top = offers
      .map((offer) => ({
        offer,
        score:
          offer._count.views +
          offer._count.saves * 3 +
          offer._count.redemptions * 8,
      }))
      .sort((a, b) => b.score - a.score)[0]?.offer;

    return {
      success: true,
      message: 'Top performing partner offer fetched successfully',
      data: top
        ? {
            id: top.id,
            title:
              top.deductionPercentage === null
                ? top.title
                : `${Number(top.deductionPercentage)}% OFF`,
            subtitle: top.productName || top.title,
            validUntil: top.endDate,
            validUntilLabel: top.endDate
              ? `Valid until ${this.formatDate(top.endDate)}`
              : null,
            views: top._count.views,
            saves: top._count.saves,
            redemptions: top._count.redemptions,
          }
        : null,
    };
  }

  async getRecentActivity(user: CurrentUserPayload) {
    this.ensurePartner(user);
    const partnerUserId = this.currentUserId(user);
    const [products, offers, redemptions] = await Promise.all([
      this.prisma.partnerProduct.findMany({
        where: { partnerUserId },
        orderBy: { updatedAt: 'desc' },
        take: 8,
        select: {
          id: true,
          productName: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.partnerOffer.findMany({
        where: { partnerUserId },
        orderBy: { updatedAt: 'desc' },
        take: 8,
        select: {
          id: true,
          title: true,
          status: true,
          endDate: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.partnerOfferRedemption.findMany({
        where: { offer: { partnerUserId } },
        include: { offer: { select: { title: true } } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);

    const activities = [
      ...offers.map((offer) => ({
        id: `offer-${offer.id}`,
        type: 'OFFER',
        title:
          offer.status === PartnerOfferStatus.ACTIVE
            ? `Offer "${offer.title}" was approved by Alurei`
            : `Offer "${offer.title}" is ${this.statusLabel(offer.status)}`,
        subtitle: this.timeAgo(offer.updatedAt),
        createdAt: offer.updatedAt,
      })),
      ...products.map((product) => ({
        id: `product-${product.id}`,
        type: 'PRODUCT',
        title: `Product "${product.productName}" was ${product.createdAt.getTime() === product.updatedAt.getTime() ? 'added to catalogue' : 'updated'}`,
        subtitle: this.timeAgo(product.updatedAt),
        createdAt: product.updatedAt,
      })),
      ...redemptions.map((redemption) => ({
        id: `redemption-${redemption.id}`,
        type: 'REDEMPTION',
        title: `Offer redeemed: ${redemption.offer.title}`,
        subtitle: this.timeAgo(redemption.createdAt),
        createdAt: redemption.createdAt,
      })),
    ];

    return {
      success: true,
      message: 'Partner recent activity fetched successfully',
      data: activities
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 8)
        .map(({ createdAt, ...item }) => ({ ...item, createdAt })),
    };
  }

  async trackView(user: CurrentUserPayload, offerId: string) {
    const offer = await this.getPublicOffer(offerId);
    const userId = this.currentUserId(user);
    const created = await this.prisma.partnerOfferView.create({
      data: { offerId: offer.id, userId },
    });
    return {
      success: true,
      message: 'Partner offer view tracked successfully',
      data: { id: created.id, offerId: offer.id },
    };
  }

  async saveOffer(user: CurrentUserPayload, offerId: string) {
    const offer = await this.getPublicOffer(offerId);
    const userId = this.currentUserId(user);
    const saved = await this.prisma.partnerOfferSave.upsert({
      where: { offerId_userId: { offerId: offer.id, userId } },
      update: {},
      create: { offerId: offer.id, userId },
    });
    return {
      success: true,
      message: 'Partner offer saved successfully',
      data: { id: saved.id, offerId: offer.id, saved: true },
    };
  }

  async redeemOffer(user: CurrentUserPayload, offerId: string) {
    const offer = await this.getPublicOffer(offerId);
    const userId = this.currentUserId(user);
    const redemption = await this.prisma.partnerOfferRedemption.create({
      data: { offerId: offer.id, userId },
    });
    return {
      success: true,
      message: 'Partner offer redemption tracked successfully',
      data: { id: redemption.id, offerId: offer.id },
    };
  }

  private async getCards(partnerUserId: string) {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1,
    );
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const activeWhere = this.activeOfferWhere(partnerUserId);

    const [
      products,
      activeOffers,
      redemptions,
      currentProducts,
      previousProducts,
      currentActiveOffers,
      previousActiveOffers,
      currentRedemptions,
      previousRedemptions,
    ] = await Promise.all([
      this.prisma.partnerProduct.count({ where: { partnerUserId } }),
      this.prisma.partnerOffer.count({ where: activeWhere }),
      this.prisma.partnerOfferRedemption.count({
        where: { offer: { partnerUserId } },
      }),
      this.prisma.partnerProduct.count({
        where: {
          partnerUserId,
          createdAt: { gte: currentMonthStart, lt: nextMonthStart },
        },
      }),
      this.prisma.partnerProduct.count({
        where: {
          partnerUserId,
          createdAt: { gte: previousMonthStart, lt: currentMonthStart },
        },
      }),
      this.prisma.partnerOffer.count({
        where: {
          ...activeWhere,
          publishedAt: { gte: currentMonthStart, lt: nextMonthStart },
        },
      }),
      this.prisma.partnerOffer.count({
        where: {
          ...activeWhere,
          publishedAt: { gte: previousMonthStart, lt: currentMonthStart },
        },
      }),
      this.prisma.partnerOfferRedemption.count({
        where: {
          offer: { partnerUserId },
          createdAt: { gte: currentMonthStart, lt: nextMonthStart },
        },
      }),
      this.prisma.partnerOfferRedemption.count({
        where: {
          offer: { partnerUserId },
          createdAt: { gte: previousMonthStart, lt: currentMonthStart },
        },
      }),
    ]);

    return {
      products: this.metric(
        'Products',
        products,
        currentProducts,
        previousProducts,
      ),
      activeOffers: this.metric(
        'Active Offers',
        activeOffers,
        currentActiveOffers,
        previousActiveOffers,
      ),
      redemptions: this.metric(
        'Redemptions',
        redemptions,
        currentRedemptions,
        previousRedemptions,
      ),
    };
  }

  private async getPartnerProfile(partnerUserId: string) {
    return this.prisma.user.findUnique({
      where: { id: partnerUserId },
      select: {
        id: true,
        fullName: true,
        partnerProfile: { select: { businessName: true } },
      },
    });
  }

  private activeOfferWhere(partnerUserId: string) {
    const now = new Date();
    return {
      partnerUserId,
      status: PartnerOfferStatus.ACTIVE,
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
      ],
    } satisfies Prisma.PartnerOfferWhereInput;
  }

  private async getPublicOffer(offerId: string) {
    const offer = await this.prisma.partnerOffer.findFirst({
      where: {
        id: offerId,
        ...this.activeOfferWhereForAnyPartner(),
      },
      select: { id: true },
    });

    if (!offer) {
      throw new NotFoundException('Partner offer not found or not active');
    }

    return offer;
  }

  private activeOfferWhereForAnyPartner() {
    const now = new Date();
    return {
      status: PartnerOfferStatus.ACTIVE,
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
      ],
    } satisfies Prisma.PartnerOfferWhereInput;
  }

  private makeBuckets(range: DashboardRange) {
    const now = new Date();
    const count = range === '7D' ? 7 : range === '30D' ? 30 : 13;
    const bucketDays = range === '3M' ? 7 : 1;
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (count - 1) * bucketDays);

    return Array.from({ length: count }, (_, index) => {
      const bucketStart = new Date(start);
      bucketStart.setDate(start.getDate() + index * bucketDays);
      const bucketEnd = new Date(bucketStart);
      bucketEnd.setDate(bucketStart.getDate() + bucketDays);
      return {
        start: bucketStart,
        end: bucketEnd,
        label:
          range === '7D'
            ? bucketStart.toLocaleDateString('en-US', { weekday: 'short' })
            : bucketStart.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              }),
      };
    });
  }

  private countByBucket(
    events: { createdAt: Date }[],
    buckets: { start: Date; end: Date }[],
  ) {
    return buckets.map(
      (bucket) =>
        events.filter(
          (event) =>
            event.createdAt >= bucket.start && event.createdAt < bucket.end,
        ).length,
    );
  }

  private greeting() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  private metric(
    label: string,
    value: number,
    current: number,
    previous: number,
  ) {
    const diff = current - previous;
    return {
      label,
      value,
      currentMonthValue: current,
      previousMonthValue: previous,
      changeValue: diff,
      changeLabel: `${diff >= 0 ? '+' : ''}${diff} vs last month`,
    };
  }

  private formatDate(date: Date) {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
    });
  }

  private statusLabel(status: PartnerOfferStatus) {
    return status
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private timeAgo(date: Date) {
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  }

  private ensurePartner(user: CurrentUserPayload) {
    if (user.role !== UserRole.PARTNER) {
      throw new ForbiddenException('Only partner users can access dashboard');
    }
  }

  private currentUserId(user: CurrentUserPayload) {
    const userId = user.userId ?? user.id;
    if (!userId) {
      throw new BadRequestException('Authenticated user id is missing');
    }
    return userId;
  }
}
