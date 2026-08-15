import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PartnerOfferStatus,
  PartnerRequestAdminStatus,
  Prisma,
  UserRole,
  UserStatus,
  VerificationStatus,
} from '@prisma/client';
import { MailService } from '../../../common/mail/mail.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { RejectPartnerDto } from './dto/reject-partner.dto';
import { UpdatePartnerRequestStatusDto } from './dto/update-partner-request-status.dto';

const PARTNER_CATEGORY_BUCKETS = [
  { key: 'SUPERMARKET', label: 'Supermarket' },
  { key: 'ENTERTAINMENT', label: 'Entertainment' },
  { key: 'TOY_STORES', label: 'Toy Stores' },
  { key: 'GENERAL_STORE', label: 'General Store' },
  { key: 'INDOOR_PLAYGROUNDS', label: 'Indoor Playgrounds' },
  { key: 'LEARNING_CENTRES', label: 'Learning Centres' },
  { key: 'BOOK_STORES', label: 'Book Stores' },
  { key: 'CHILDRENS_CAFES', label: "Children's Cafés" },
  { key: 'OTHER', label: 'Other' },
] as const;

@Injectable()
export class AdminPartnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async getPartners(status?: string) {
    const adminStatus = this.adminStatusFilter(status);
    const userStatus = this.statusFilter(status);
    const where = {
      role: UserRole.PARTNER,
      ...(userStatus && { status: userStatus }),
      ...(adminStatus && { partnerProfile: { adminStatus } }),
    };

    const partners = await this.prisma.user.findMany({
      where,
      include: {
        partnerProfile: true,
        stores: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: partners.map((partner) => this.formatPartner(partner)),
      message: 'Partner requests fetched successfully.',
    };
  }

  async getPartnerNewRequests(status?: string) {
    const adminStatus = this.adminStatusFilter(status);
    const where = {
      role: UserRole.PARTNER,
      status: { not: UserStatus.ACTIVE },
      verificationStatus: { not: VerificationStatus.APPROVED },
      partnerProfile: {
        is: {
          ...(adminStatus && { adminStatus }),
        },
      },
    } satisfies Prisma.UserWhereInput;

    const partners = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        partnerProfile: {
          select: {
            businessName: true,
            businessCategory: true,
            shortDescription: true,
            adminStatus: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: partners.map((partner) => this.formatPartnerRequestRow(partner)),
      message: 'Partner new requests fetched successfully.',
    };
  }

  async getPartner(id: string) {
    const partner = await this.findPartner(id);

    return {
      data: this.formatPartner(partner),
      message: 'Partner request fetched successfully.',
    };
  }

  async updatePartnerRequestStatus(
    id: string,
    adminUserId: string,
    dto: UpdatePartnerRequestStatusDto,
  ) {
    await this.findPartner(id);

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
        ...(dto.status === PartnerRequestAdminStatus.DECLINED && {
          status: UserStatus.INACTIVE,
          verificationStatus: VerificationStatus.REJECTED,
        }),
        partnerProfile: {
          update: {
            adminStatus: dto.status,
            ...(dto.adminNote !== undefined && {
              adminNote: dto.adminNote,
            }),
            reviewedBy: adminUserId,
            reviewedAt: new Date(),
          },
        },
      },
      include: {
        partnerProfile: true,
        stores: true,
      },
    });

    return {
      data: this.formatPartner(updated),
      message: 'Partner request status updated successfully.',
    };
  }

  async getOverview() {
    return this.getOverviewCards();
  }

  async getOverviewCards() {
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
    const partnerWhere = {
      role: UserRole.PARTNER,
      status: { not: UserStatus.DELETED },
    } satisfies Prisma.UserWhereInput;
    const activeOfferWhere = this.activeOfferWhere(now);

    const [
      totalPartners,
      currentPartners,
      previousPartners,
      activeOffers,
      currentActiveOffers,
      previousActiveOffers,
      partnerSparkline,
      activeOfferSparkline,
    ] = await Promise.all([
      this.prisma.user.count({ where: partnerWhere }),
      this.prisma.user.count({
        where: { ...partnerWhere, createdAt: currentMonth },
      }),
      this.prisma.user.count({
        where: { ...partnerWhere, createdAt: previousMonth },
      }),
      this.prisma.partnerOffer.count({ where: activeOfferWhere }),
      this.prisma.partnerOffer.count({
        where: { ...activeOfferWhere, createdAt: currentMonth },
      }),
      this.prisma.partnerOffer.count({
        where: { ...activeOfferWhere, createdAt: previousMonth },
      }),
      this.monthlyDailySeries('partners', currentMonthStart, nextMonthStart),
      this.monthlyDailySeries(
        'activeOffers',
        currentMonthStart,
        nextMonthStart,
      ),
    ]);

    const cards = [
      this.metric({
        key: 'totalPartners',
        label: 'Total Partners',
        value: totalPartners,
        current: currentPartners,
        previous: previousPartners,
        sparkline: partnerSparkline,
      }),
      this.metric({
        key: 'activeOffers',
        label: 'Active Offers',
        value: activeOffers,
        current: currentActiveOffers,
        previous: previousActiveOffers,
        sparkline: activeOfferSparkline,
      }),
    ];

    return {
      success: true,
      message: 'Admin partner overview cards fetched successfully.',
      data: cards,
    };
  }

  async getPartnersByCategory() {
    const partnerWhere = {
      role: UserRole.PARTNER,
      status: { not: UserStatus.DELETED },
    } satisfies Prisma.UserWhereInput;
    const categoryGroups = await this.prisma.partnerProfile.groupBy({
      by: ['businessCategory'],
      where: { user: partnerWhere },
      _count: { _all: true },
    });
    const counts = new Map<string, number>(
      PARTNER_CATEGORY_BUCKETS.map((category) => [category.key, 0]),
    );

    for (const group of categoryGroups) {
      const key = this.categoryBucketKey(group.businessCategory);
      counts.set(key, (counts.get(key) ?? 0) + group._count._all);
    }

    const total = [...counts.values()].reduce((sum, count) => sum + count, 0);

    return {
      success: true,
      message: 'Admin partner categories fetched successfully.',
      data: {
        total,
        partnersByCategory: PARTNER_CATEGORY_BUCKETS.map((category) => {
          const value = counts.get(category.key) ?? 0;

          return {
            key: category.key,
            label: category.label,
            value,
            percentage:
              total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0,
          };
        }),
      },
    };
  }

  async getAttentionRequired() {
    const now = new Date();
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setUTCDate(sevenDaysFromNow.getUTCDate() + 7);
    const pendingPartnerWhere = {
      role: UserRole.PARTNER,
      OR: [
        { status: UserStatus.PENDING },
        {
          verificationStatus: {
            in: [
              VerificationStatus.PENDING,
              VerificationStatus.DOCUMENTS_SUBMITTED,
              VerificationStatus.UNDER_REVIEW,
            ],
          },
        },
      ],
    } satisfies Prisma.UserWhereInput;
    const activeOfferWhere = this.activeOfferWhere(now);
    const [pendingPartnerRequests, pendingOfferApprovals, expiringOffers] =
      await Promise.all([
        this.prisma.user.count({ where: pendingPartnerWhere }),
        this.prisma.partnerOffer.count({
          where: { status: PartnerOfferStatus.PENDING_APPROVAL },
        }),
        this.prisma.partnerOffer.count({
          where: {
            ...activeOfferWhere,
            endDate: { gte: now, lte: sevenDaysFromNow },
          },
        }),
      ]);

    return {
      success: true,
      message: 'Admin partner attention items fetched successfully.',
      data: {
        window: {
          now,
          expiringOfferWindowEnd: sevenDaysFromNow,
        },
        attention: [
          {
            key: 'pendingPartnerRequests',
            severity: 'critical',
            count: pendingPartnerRequests,
            message: `${pendingPartnerRequests.toLocaleString()} new partnership requests awaiting review`,
            actionLabel: 'Review requests',
            route: '/admin/partners?status=PENDING',
          },
          {
            key: 'pendingOfferApprovals',
            severity: 'warning',
            count: pendingOfferApprovals,
            message: `${pendingOfferApprovals.toLocaleString()} offers are pending admin approval before going live`,
            actionLabel: 'Review offers',
            route: '/admin/partners/offers?status=PENDING_APPROVAL',
          },
          {
            key: 'expiringOffers',
            severity: 'warning',
            count: expiringOffers,
            message: `${expiringOffers.toLocaleString()} active offers expire within the next 7 days`,
            actionLabel: 'View expiring',
            route: `/admin/partners/offers?status=ACTIVE&endDateTo=${encodeURIComponent(
              sevenDaysFromNow.toISOString(),
            )}`,
          },
        ],
      },
    };
  }

  async approvePartner(id: string, adminUserId: string) {
    const partner = await this.findPartner(id);

    if (partner.status === UserStatus.ACTIVE) {
      throw new BadRequestException('Partner is already approved.');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.ACTIVE,
        verificationStatus: VerificationStatus.APPROVED,
        rejectionReason: null,
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
        partnerProfile: {
          update: {
            reviewedBy: adminUserId,
            reviewedAt: new Date(),
          },
        },
      },
      include: {
        partnerProfile: true,
        stores: true,
      },
    });

    await this.mailService.sendDummyEmail(
      updated.email,
      'Your Alurei Partners account has been approved',
      `Hi ${updated.fullName},

Good news — your Alurei Partners request has been approved.

You can now log in and start setting up your partner rewards and store details.

Thank you,
Alurei Partners Team`,
    );

    return {
      data: this.formatPartner(updated),
      message: 'Partner approved successfully.',
    };
  }

  async rejectPartner(id: string, adminUserId: string, dto: RejectPartnerDto) {
    const partner = await this.findPartner(id);

    if (partner.status === UserStatus.ACTIVE) {
      throw new BadRequestException(
        'Approved partners cannot be rejected. Suspend the account instead.',
      );
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.INACTIVE,
        verificationStatus: VerificationStatus.REJECTED,
        rejectionReason: dto.reason,
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
        partnerProfile: {
          update: {
            reviewedBy: adminUserId,
            reviewedAt: new Date(),
          },
        },
      },
      include: {
        partnerProfile: true,
        stores: true,
      },
    });

    await this.mailService.sendDummyEmail(
      updated.email,
      'Your Alurei Partners request was not approved',
      `Hi ${updated.fullName},

Thank you for applying to Alurei Partners.

After reviewing your request, we are unable to approve it at this time.

Reason: ${dto.reason}

If you believe this was a mistake, please contact our support team.

Thank you,
Alurei Partners Team`,
    );

    return {
      data: this.formatPartner(updated),
      message: 'Partner rejected successfully.',
    };
  }

  private async findPartner(id: string) {
    const partner = await this.prisma.user.findFirst({
      where: { id, role: UserRole.PARTNER },
      include: {
        partnerProfile: true,
        stores: true,
      },
    });

    if (!partner) {
      throw new NotFoundException('Partner request not found.');
    }

    return partner;
  }

  private statusFilter(status?: string) {
    if (!status || status.toUpperCase() === 'ALL') return undefined;

    const normalized = status.toUpperCase();
    if (normalized === 'APPROVED') return UserStatus.ACTIVE;
    if (normalized === 'REJECTED') return UserStatus.INACTIVE;
    if (normalized === 'PENDING') return UserStatus.PENDING;

    if (Object.values(UserStatus).includes(normalized as UserStatus)) {
      return normalized as UserStatus;
    }

    return undefined;
  }

  private adminStatusFilter(status?: string) {
    if (!status || status.toUpperCase() === 'ALL') return undefined;

    const normalized = status
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase();

    if (
      Object.values(PartnerRequestAdminStatus).includes(
        normalized as PartnerRequestAdminStatus,
      )
    ) {
      return normalized as PartnerRequestAdminStatus;
    }

    return undefined;
  }

  private activeOfferWhere(now: Date) {
    return {
      status: PartnerOfferStatus.ACTIVE,
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
      ],
    } satisfies Prisma.PartnerOfferWhereInput;
  }

  private metric(input: {
    key: string;
    label: string;
    value: number;
    current: number;
    previous: number;
    sparkline: number[];
  }) {
    const changeValue = input.current - input.previous;
    const changePercent = this.changePercent(input.current, input.previous);

    return {
      key: input.key,
      label: input.label,
      value: input.value,
      formattedValue: input.value.toLocaleString(),
      growthPercent: changePercent,
      growthLabel: this.changeLabel(changePercent, changeValue),
      growthDirection:
        changeValue > 0 ? 'up' : changeValue < 0 ? 'down' : 'flat',
      sparkline: input.sparkline,
    };
  }

  private changePercent(current: number, previous: number) {
    if (previous === 0) {
      return current === 0 ? 0 : null;
    }

    return Number((((current - previous) / previous) * 100).toFixed(1));
  }

  private changeLabel(changePercent: number | null, changeValue: number) {
    if (changePercent !== null) {
      if (changePercent === 0) return '0%';
      return `${changePercent > 0 ? '+' : ''}${changePercent}%`;
    }

    if (changeValue === 0) return '0';
    return `${changeValue > 0 ? '+' : ''}${changeValue.toLocaleString()}`;
  }

  private async monthlyDailySeries(
    kind: 'partners' | 'activeOffers',
    start: Date,
    end: Date,
  ) {
    const days = Math.max(
      1,
      Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)),
    );
    const series = Array.from({ length: days }, () => 0);
    const rows =
      kind === 'partners'
        ? await this.prisma.user.findMany({
            where: {
              role: UserRole.PARTNER,
              status: { not: UserStatus.DELETED },
              createdAt: { gte: start, lt: end },
            },
            select: { createdAt: true },
          })
        : await this.prisma.partnerOffer.findMany({
            where: {
              ...this.activeOfferWhere(new Date()),
              createdAt: { gte: start, lt: end },
            },
            select: { createdAt: true },
          });

    for (const row of rows) {
      const index = Math.floor(
        (row.createdAt.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
      );
      if (index >= 0 && index < series.length) {
        series[index] += 1;
      }
    }

    return series;
  }

  private categoryBucketKey(category: string) {
    const normalized = category
      .trim()
      .replace(/&/g, 'and')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase();

    if (
      normalized === 'SUPERMARKET' ||
      normalized === 'GROCERY_SUPERMARKET' ||
      normalized === 'GROCERY_AND_SUPERMARKET'
    ) {
      return 'SUPERMARKET';
    }

    if (normalized === 'CHILDRENS_CAFES' || normalized === 'CHILDREN_S_CAFES') {
      return 'CHILDRENS_CAFES';
    }

    return PARTNER_CATEGORY_BUCKETS.some((bucket) => bucket.key === normalized)
      ? normalized
      : 'OTHER';
  }

  private formatPartner(partner: any) {
    const profile = partner.partnerProfile;
    const primaryStore = partner.stores?.[0] ?? null;

    return {
      id: partner.id,
      businessName: profile?.businessName ?? partner.fullName,
      businessCategory: profile?.businessCategory ?? null,
      category: profile?.businessCategory ?? null,
      shortDescription: profile?.shortDescription ?? null,
      message: profile?.shortDescription ?? null,
      website: profile?.website ?? null,
      country: profile?.country ?? null,
      city: profile?.city ?? null,
      location:
        [profile?.city, profile?.country].filter(Boolean).join(', ') || null,
      address: profile?.address ?? null,
      openingHours: profile?.openingHours ?? null,
      contactPerson: profile?.contactPerson ?? partner.fullName,
      contactRole: profile?.contactRole ?? null,
      contactEmail: profile?.contactEmail ?? partner.email,
      contactPhone: profile?.contactPhone ?? partner.phoneNumber,
      email: partner.email,
      phoneNumber: partner.phoneNumber,
      adminStatus: profile?.adminStatus ?? PartnerRequestAdminStatus.NEW,
      adminStatusLabel: this.adminStatusLabel(
        profile?.adminStatus ?? PartnerRequestAdminStatus.NEW,
      ),
      adminNote: profile?.adminNote ?? null,
      status: this.partnerStatusLabel(
        partner.status,
        partner.verificationStatus,
      ),
      rawStatus: partner.status,
      verificationStatus: partner.verificationStatus,
      rejectionReason: partner.rejectionReason,
      reviewedBy: partner.reviewedBy,
      reviewedAt: partner.reviewedAt,
      submittedAt: partner.createdAt,
      businessInformation: {
        businessName: profile?.businessName ?? partner.fullName,
        businessCategory: profile?.businessCategory ?? null,
        website: profile?.website ?? null,
        contactPerson: profile?.contactPerson ?? partner.fullName,
        role: profile?.contactRole ?? null,
        email: profile?.contactEmail ?? partner.email,
        phone: profile?.contactPhone ?? partner.phoneNumber,
        location:
          [profile?.city, profile?.country].filter(Boolean).join(', ') || null,
        address: profile?.address ?? null,
        message: profile?.shortDescription ?? null,
      },
      primaryStore,
      stores: partner.stores,
    };
  }

  private formatPartnerRequestRow(partner: {
    id: string;
    createdAt: Date;
    partnerProfile: {
      businessName: string;
      businessCategory: string;
      shortDescription: string | null;
      adminStatus: PartnerRequestAdminStatus;
    } | null;
  }) {
    const adminStatus =
      partner.partnerProfile?.adminStatus ?? PartnerRequestAdminStatus.NEW;

    return {
      id: partner.id,
      business: partner.partnerProfile?.businessName ?? null,
      description: partner.partnerProfile?.shortDescription ?? null,
      category: partner.partnerProfile?.businessCategory ?? null,
      status: adminStatus,
      statusLabel: this.adminStatusLabel(adminStatus),
      submitted: partner.createdAt,
    };
  }

  private adminStatusLabel(status: PartnerRequestAdminStatus) {
    const labels: Record<PartnerRequestAdminStatus, string> = {
      [PartnerRequestAdminStatus.NEW]: 'New',
      [PartnerRequestAdminStatus.CONTACTED]: 'Contacted',
      [PartnerRequestAdminStatus.IN_DISCUSSION]: 'In discussion',
      [PartnerRequestAdminStatus.DECLINED]: 'Declined',
    };

    return labels[status];
  }

  private partnerStatusLabel(
    status: UserStatus,
    verificationStatus: VerificationStatus,
  ) {
    if (status === UserStatus.ACTIVE) return 'APPROVED';
    if (verificationStatus === VerificationStatus.REJECTED) return 'REJECTED';
    return 'PENDING';
  }
}
