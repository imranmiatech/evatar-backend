import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityStatus,
  Prisma,
  RewardClaimMethod,
  RewardLedgerEntry,
  RewardLedgerEntryType,
  RewardLedgerSourceType,
  RewardOfferChannel,
  RewardOfferStatus,
  RewardRedemptionStatus,
  RewardRuleStatus,
  RewardRuleUserType,
  Store,
  UserRole,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { StorageService } from '../../common/storage/storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CaregiverService } from '../caregiver/caregiver.service';
import { CreateRewardOfferDto } from './dto/create-reward-offer.dto';
import {
  CreatePartnerStoreDto,
  UpdatePartnerStoreDto,
} from './dto/partner-store.dto';
import { RewardOfferQueryDto } from './dto/reward-query.dto';
import { UpdateRewardOfferDto } from './dto/update-reward-offer.dto';
import { UseRedemptionDto } from './dto/use-redemption.dto';

const POINTS_PER_COMPLETED_TASK = 2;
const REDEMPTION_EXPIRY_DAYS = 180;
const DAILY_FLOW_REWARD_RULE_KEY = 'COMPLETE_DAILY_FLOW';
const CARE_MODULE_REWARD_RULE_KEY = 'COMPLETE_CARE_MODULE';
const REWARD_HUB_ACTIVITY_LIMIT = 20;
const REWARD_HUB_RECENT_DAYS = 7;

@Injectable()
export class RewardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caregiverService: CaregiverService,
    private readonly storageService: StorageService,
  ) {}

  async getRewardHub(user: CurrentUserPayload) {
    this.ensureRewardUser(user);
    const userId = this.currentUserId(user);
    const now = new Date();
    const recentStart = this.addDays(now, -REWARD_HUB_RECENT_DAYS);

    const [account, earnedEntries, spentEntries, earnedSummary, spentSummary] =
      await Promise.all([
        this.ensureRewardAccount(userId),
        this.prisma.rewardLedgerEntry.findMany({
          where: {
            userId,
            entryType: RewardLedgerEntryType.EARN,
            createdAt: { gte: recentStart },
          },
          orderBy: { createdAt: 'desc' },
          take: REWARD_HUB_ACTIVITY_LIMIT,
        }),
        this.prisma.rewardLedgerEntry.findMany({
          where: {
            userId,
            entryType: RewardLedgerEntryType.SPEND,
            createdAt: { gte: recentStart },
          },
          orderBy: { createdAt: 'desc' },
          take: REWARD_HUB_ACTIVITY_LIMIT,
        }),
        this.prisma.rewardLedgerEntry.aggregate({
          where: {
            userId,
            entryType: RewardLedgerEntryType.EARN,
            createdAt: { gte: recentStart },
          },
          _count: { _all: true },
          _sum: { points: true },
        }),
        this.prisma.rewardLedgerEntry.aggregate({
          where: {
            userId,
            entryType: RewardLedgerEntryType.SPEND,
            createdAt: { gte: recentStart },
          },
          _count: { _all: true },
          _sum: { points: true },
        }),
      ]);

    const latestEarn = earnedEntries[0] ?? null;

    return {
      success: true,
      message: 'Reward hub fetched successfully',
      data: {
        balanceCard: {
          availableBalance: account.balance,
          lifetimeEarned: account.lifetimeEarned,
          lifetimeSpent: account.lifetimeSpent,
          unit: 'Alurei',
          primaryAction: {
            label: 'Use Care Moments',
            action: 'OPEN_CARE_MOMENTS',
          },
        },
        tabs: [
          {
            key: RewardLedgerEntryType.EARN,
            label: 'Earn',
            count: earnedSummary._count._all,
            totalPoints: earnedSummary._sum.points ?? 0,
          },
          {
            key: RewardLedgerEntryType.SPEND,
            label: 'Spend',
            count: spentSummary._count._all,
            totalPoints: Math.abs(spentSummary._sum.points ?? 0),
          },
        ],
        earnedLastWeek: earnedEntries.map((entry) =>
          this.formatRewardHubActivity(entry, now),
        ),
        spentLastWeek: spentEntries.map((entry) =>
          this.formatRewardHubActivity(entry, now),
        ),
        careMomentRecognition: latestEarn
          ? {
              available: true,
              ledgerEntryId: latestEarn.id,
              title: 'Your Care Has Been Recognized',
              message:
                'Thank you for your continued dedication. Every meaningful care moment helps create a better journey for your child while earning Alurei along the way.',
              pointsEarned: latestEarn.points,
              sourceType: latestEarn.sourceType,
              recognizedAt: latestEarn.createdAt,
            }
          : {
              available: false,
              ledgerEntryId: null,
              title: null,
              message: null,
              pointsEarned: 0,
              sourceType: null,
              recognizedAt: null,
            },
        period: {
          label: 'Last 7 days',
          start: recentStart,
          end: now,
        },
      },
    };
  }





  async getMyRedemptions(user: CurrentUserPayload) {
    const userId = this.currentUserId(user);
    const now = new Date();
    const redemptions = await this.prisma.rewardRedemption.findMany({
      where: { userId },
      include: { offer: { include: this.offerInclude() } },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      message: 'Reward redemptions fetched successfully',
      data: redemptions.map((redemption) =>
        this.formatRedemption(redemption, now),
      ),
    };
  }



  async completeTaskForReward(user: CurrentUserPayload, dayActivityId: string) {
    this.ensureRewardUser(user);
    const userId = this.currentUserId(user);

    const activity = await this.prisma.dayActivity.findUnique({
      where: { id: dayActivityId },
      include: {
        dayPlan: {
          select: {
            childId: true,
            child: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!activity) {
      throw new NotFoundException('Task not found');
    }

    await this.caregiverService.assertChildPermission(
      userId,
      activity.dayPlan.childId,
      'dailyActivitiesRecipes',
    );

    await this.prisma.dayActivity.update({
      where: { id: dayActivityId },
      data: { status: ActivityStatus.COMPLETED },
    });

    const award = await this.awardCompletedTask(userId, dayActivityId, {
      title: activity.title,
      childId: activity.dayPlan.childId,
      childName: activity.dayPlan.child.name,
      completedByRole: user.role,
    });

    return {
      success: true,
      message: award.awarded
        ? 'Task completed and reward points awarded successfully'
        : 'Task was already rewarded',
      data: {
        dayActivityId,
        pointsEarned: award.awarded ? award.points : 0,
        account: award.account,
      },
    };
  }



  async createPartnerOffer(
    user: CurrentUserPayload,
    dto: CreateRewardOfferDto,
    image?: Express.Multer.File,
  ) {
    this.ensurePartner(user);
    const partnerUserId = this.currentUserId(user);
    const storeIds = await this.resolvePartnerStoreIds(
      partnerUserId,
      dto.storeIds,
      dto.storeId,
    );
    const uploadedImageUrl = image
      ? await this.storageService.uploadFile(image, 'reward-offers')
      : null;
    const locations = this.parseOfferLocations(dto.locations);

    const offer = await this.prisma.rewardOffer.create({
      data: {
        partnerUserId,
        storeId: storeIds[0],
        title: dto.title.trim(),
        productName: dto.productName.trim(),
        description: dto.description?.trim(),
        includedTitle: dto.includedTitle?.trim(),
        includedDescription: dto.includedDescription?.trim(),
        terms: dto.terms?.trim(),
        imageUrl: uploadedImageUrl ?? dto.imageUrl?.trim(),
        channel: dto.channel ?? RewardOfferChannel.BOTH,
        onlineCouponCode: dto.onlineCouponCode?.trim(),
        websiteUrl: dto.websiteUrl?.trim(),
        pointsCost: dto.pointsCost,
        availableQuantity: dto.availableQuantity,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        status: RewardOfferStatus.ACTIVE,
        ...(locations.length > 0 && {
          locations: { create: locations },
        }),
        ...(storeIds.length > 0 && {
          stores: {
            create: storeIds.map((storeId) => ({ storeId })),
          },
        }),
      },
      include: this.offerInclude(),
    });

    return {
      success: true,
      message: 'Reward offer created successfully',
      data: this.formatOffer(offer),
    };
  }

  async createPartnerStore(
    user: CurrentUserPayload,
    dto: CreatePartnerStoreDto,
  ) {
    this.ensurePartner(user);
    const partnerUserId = this.currentUserId(user);

    const store = await this.prisma.store.create({
      data: {
        userId: partnerUserId,
        name: dto.name.trim(),
        address: dto.address?.trim(),
        city: dto.city?.trim(),
        description: dto.description?.trim(),
        logoUrl: dto.logoUrl?.trim(),
        latitude: dto.latitude,
        longitude: dto.longitude,
        mapUrl: dto.mapUrl?.trim(),
      },
    });

    return {
      success: true,
      message: 'Partner store created successfully',
      data: this.formatStore(store),
    };
  }

  async getPartnerStores(user: CurrentUserPayload) {
    this.ensurePartner(user);
    const partnerUserId = this.currentUserId(user);
    const stores = await this.prisma.store.findMany({
      where: { userId: partnerUserId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      message: 'Partner stores fetched successfully',
      data: stores.map((store) => this.formatStore(store)),
    };
  }

  async getPartnerStore(user: CurrentUserPayload, storeId: string) {
    this.ensurePartner(user);
    const partnerUserId = this.currentUserId(user);
    const store = await this.getOwnedStore(partnerUserId, storeId);

    return {
      success: true,
      message: 'Partner store fetched successfully',
      data: this.formatStore(store),
    };
  }

  async updatePartnerStore(
    user: CurrentUserPayload,
    storeId: string,
    dto: UpdatePartnerStoreDto,
  ) {
    this.ensurePartner(user);
    const partnerUserId = this.currentUserId(user);
    await this.getOwnedStore(partnerUserId, storeId);

    const store = await this.prisma.store.update({
      where: { id: storeId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.address !== undefined && { address: dto.address?.trim() }),
        ...(dto.city !== undefined && { city: dto.city?.trim() }),
        ...(dto.description !== undefined && {
          description: dto.description?.trim(),
        }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl?.trim() }),
        ...(dto.latitude !== undefined && { latitude: dto.latitude }),
        ...(dto.longitude !== undefined && { longitude: dto.longitude }),
        ...(dto.mapUrl !== undefined && { mapUrl: dto.mapUrl?.trim() }),
      },
    });

    return {
      success: true,
      message: 'Partner store updated successfully',
      data: this.formatStore(store),
    };
  }

  async deletePartnerStore(user: CurrentUserPayload, storeId: string) {
    this.ensurePartner(user);
    const partnerUserId = this.currentUserId(user);
    await this.getOwnedStore(partnerUserId, storeId);

    const [orderCount, offerCount] = await Promise.all([
      this.prisma.groceryOrder.count({ where: { storeId } }),
      this.prisma.rewardOfferStore.count({ where: { storeId } }),
    ]);

    if (orderCount > 0 || offerCount > 0) {
      throw new BadRequestException(
        'Store is already linked to orders or reward offers',
      );
    }

    await this.prisma.store.delete({ where: { id: storeId } });

    return {
      success: true,
      message: 'Partner store deleted successfully',
      data: { storeId },
    };
  }

  async getPartnerOffers(user: CurrentUserPayload, query: RewardOfferQueryDto) {
    this.ensurePartner(user);
    const partnerUserId = this.currentUserId(user);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = {
      partnerUserId,
      ...(query.status && { status: query.status }),
    } satisfies Prisma.RewardOfferWhereInput;

    const [offers, total] = await Promise.all([
      this.prisma.rewardOffer.findMany({
        where,
        include: this.offerInclude(),
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.rewardOffer.count({ where }),
    ]);

    return {
      success: true,
      message: 'Partner reward offers fetched successfully',
      data: offers.map((offer) => this.formatOffer(offer)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updatePartnerOffer(
    user: CurrentUserPayload,
    offerId: string,
    dto: UpdateRewardOfferDto,
  ) {
    this.ensurePartner(user);
    const partnerUserId = this.currentUserId(user);
    const existing = await this.prisma.rewardOffer.findFirst({
      where: { id: offerId, partnerUserId },
    });

    if (!existing) {
      throw new NotFoundException('Reward offer not found');
    }

    const storeIds =
      dto.storeIds !== undefined || dto.storeId !== undefined
        ? await this.resolvePartnerStoreIds(
            partnerUserId,
            dto.storeIds,
            dto.storeId,
          )
        : undefined;

    const offer = await this.prisma.rewardOffer.update({
      where: { id: offerId },
      data: {
        ...(storeIds !== undefined && { storeId: storeIds[0] ?? null }),
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.productName !== undefined && {
          productName: dto.productName.trim(),
        }),
        ...(dto.description !== undefined && {
          description: dto.description?.trim(),
        }),
        ...(dto.includedTitle !== undefined && {
          includedTitle: dto.includedTitle?.trim(),
        }),
        ...(dto.includedDescription !== undefined && {
          includedDescription: dto.includedDescription?.trim(),
        }),
        ...(dto.terms !== undefined && { terms: dto.terms?.trim() }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl?.trim() }),
        ...(dto.channel !== undefined && { channel: dto.channel }),
        ...(dto.onlineCouponCode !== undefined && {
          onlineCouponCode: dto.onlineCouponCode?.trim(),
        }),
        ...(dto.websiteUrl !== undefined && {
          websiteUrl: dto.websiteUrl?.trim(),
        }),
        ...(dto.pointsCost !== undefined && { pointsCost: dto.pointsCost }),
        ...(dto.availableQuantity !== undefined && {
          availableQuantity: dto.availableQuantity,
        }),
        ...(dto.startsAt !== undefined && {
          startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        }),
        ...(dto.endsAt !== undefined && {
          endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.locations !== undefined && {
          locations: {
            deleteMany: {},
            create: this.parseOfferLocations(dto.locations),
          },
        }),
        ...(storeIds !== undefined && {
          stores: {
            deleteMany: {},
            create: storeIds.map((storeId) => ({ storeId })),
          },
        }),
      },
      include: this.offerInclude(),
    });

    return {
      success: true,
      message: 'Reward offer updated successfully',
      data: this.formatOffer(offer),
    };
  }

  async useRedemptionCode(user: CurrentUserPayload, code: string) {
    return this.useRedemption(user, { code });
  }

  async scanRedemption(user: CurrentUserPayload, dto: UseRedemptionDto) {
    this.ensurePartner(user);
    return this.useRedemption(user, dto);
  }

  private async useRedemption(user: CurrentUserPayload, dto: UseRedemptionDto) {
    this.ensurePartner(user);
    const partnerUserId = this.currentUserId(user);
    const now = new Date();
    const code = dto.code?.trim();
    const qrToken = dto.qrToken?.trim();

    if (!code && !qrToken) {
      throw new BadRequestException('QR token or code is required');
    }

    const redemption = await this.prisma.rewardRedemption.findFirst({
      where: {
        OR: [...(code ? [{ code }] : []), ...(qrToken ? [{ qrToken }] : [])],
      },
      include: { offer: { include: this.offerInclude() }, user: true },
    });

    if (!redemption || redemption.offer.partnerUserId !== partnerUserId) {
      throw new NotFoundException('Reward redemption not found');
    }

    if (redemption.status !== RewardRedemptionStatus.ACTIVE) {
      throw new BadRequestException('Reward redemption is not active');
    }

    if (redemption.expiresAt < now) {
      await this.prisma.rewardRedemption.update({
        where: { id: redemption.id },
        data: { status: RewardRedemptionStatus.EXPIRED },
      });
      throw new BadRequestException('Reward redemption has expired');
    }

    const updated = await this.prisma.rewardRedemption.update({
      where: { id: redemption.id },
      data: {
        status: RewardRedemptionStatus.USED,
        usedAt: now,
        usedByPartnerUserId: partnerUserId,
      },
      include: { offer: { include: this.offerInclude() }, user: true },
    });

    return {
      success: true,
      message: 'Reward redemption marked as used successfully',
      data: this.formatRedemption(updated, now),
    };
  }

  async awardCompletedTask(
    userId: string,
    dayActivityId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    const rule = await this.resolveRewardRule(
      DAILY_FLOW_REWARD_RULE_KEY,
      (metadata as Record<string, unknown> | undefined)?.completedByRole as
        UserRole | undefined,
      POINTS_PER_COMPLETED_TASK,
    );

    if (!rule.shouldAward) {
      const account = await this.ensureRewardAccount(userId);
      return {
        awarded: false,
        account,
        ledgerEntry: null,
        points: 0,
        reason: rule.reason,
      };
    }

    return this.awardOnce({
      userId,
      points: rule.points,
      sourceType: RewardLedgerSourceType.DAY_ACTIVITY,
      sourceId: dayActivityId,
      description: 'Completed task',
      metadata: this.withRewardRuleMetadata(metadata, rule),
      rewardRuleActivityKey: rule.activityKey,
      weeklyLimit: rule.weeklyLimit,
    });
  }

  async awardCareModuleCompletion(
    userId: string,
    assignmentId: string,
    points: number,
    metadata?: Prisma.InputJsonValue,
  ) {
    const rule = await this.resolveRewardRule(
      CARE_MODULE_REWARD_RULE_KEY,
      (metadata as Record<string, unknown> | undefined)?.completedByRole as
        UserRole | undefined,
      points,
    );

    if (!rule.shouldAward) {
      const account = await this.ensureRewardAccount(userId);
      return {
        awarded: false,
        account,
        ledgerEntry: null,
        points: 0,
        reason: rule.reason,
      };
    }

    return this.awardOnce({
      userId,
      points: rule.points,
      sourceType: RewardLedgerSourceType.CARE_MODULE_ASSIGNMENT,
      sourceId: assignmentId,
      description: 'Completed care module',
      metadata: this.withRewardRuleMetadata(metadata, rule),
      rewardRuleActivityKey: rule.activityKey,
      weeklyLimit: rule.weeklyLimit,
    });
  }

  private async awardOnce(input: {
    userId: string;
    points: number;
    sourceType: RewardLedgerSourceType;
    sourceId: string;
    description: string;
    metadata?: Prisma.InputJsonValue;
    rewardRuleActivityKey?: string;
    weeklyLimit?: number | null;
  }) {
    if (input.points <= 0) {
      throw new BadRequestException('Reward points must be greater than zero');
    }

    return this.prisma.$transaction(async (tx) => {
      if (input.rewardRuleActivityKey && input.weeklyLimit) {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setUTCHours(0, 0, 0, 0);
        weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());

        const weeklyAwardCount = await tx.rewardLedgerEntry.count({
          where: {
            userId: input.userId,
            entryType: RewardLedgerEntryType.EARN,
            createdAt: { gte: weekStart },
            metadata: {
              path: ['rewardRuleActivityKey'],
              equals: input.rewardRuleActivityKey,
            },
          },
        });

        if (weeklyAwardCount >= input.weeklyLimit) {
          const account = await this.ensureRewardAccountForTx(tx, input.userId);
          return {
            awarded: false,
            account,
            ledgerEntry: null,
            points: 0,
            reason: 'WEEKLY_LIMIT_REACHED',
          };
        }
      }

      const existing = await tx.rewardLedgerEntry.findUnique({
        where: {
          entryType_sourceType_sourceId: {
            entryType: RewardLedgerEntryType.EARN,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
          },
        },
      });

      if (existing) {
        const account = await this.ensureRewardAccountForTx(tx, input.userId);
        return {
          awarded: false,
          account,
          ledgerEntry: existing,
          points: 0,
          reason: 'ALREADY_REWARDED',
        };
      }

      const account = await tx.rewardAccount.upsert({
        where: { userId: input.userId },
        update: {
          balance: { increment: input.points },
          lifetimeEarned: { increment: input.points },
        },
        create: {
          userId: input.userId,
          balance: input.points,
          lifetimeEarned: input.points,
        },
      });

      const ledgerEntry = await tx.rewardLedgerEntry.create({
        data: {
          userId: input.userId,
          entryType: RewardLedgerEntryType.EARN,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          points: input.points,
          balanceAfter: account.balance,
          description: input.description,
          metadata: input.metadata,
        },
      });

      return { awarded: true, account, ledgerEntry, points: input.points };
    });
  }

  private async resolveRewardRule(
    activityKey: string,
    role: UserRole | undefined,
    fallbackPoints: number,
  ) {
    const rule = await this.prisma.rewardRule.findUnique({
      where: { activityKey },
    });

    if (!rule) {
      return {
        shouldAward: true,
        activityKey,
        ruleId: null,
        points: fallbackPoints,
        weeklyLimit: null,
      };
    }

    if (rule.status !== RewardRuleStatus.ACTIVE) {
      return {
        shouldAward: false,
        activityKey,
        ruleId: rule.id,
        points: 0,
        weeklyLimit: rule.weeklyLimit,
        reason: 'REWARD_RULE_DISABLED',
      };
    }

    if (role && !this.isEligibleForRewardRule(rule.eligibleUserTypes, role)) {
      return {
        shouldAward: false,
        activityKey,
        ruleId: rule.id,
        points: 0,
        weeklyLimit: rule.weeklyLimit,
        reason: 'USER_TYPE_NOT_ELIGIBLE',
      };
    }

    return {
      shouldAward: true,
      activityKey: rule.activityKey,
      ruleId: rule.id,
      points: rule.alureiValue,
      weeklyLimit: rule.weeklyLimit,
    };
  }

  private isEligibleForRewardRule(
    eligibleUserTypes: RewardRuleUserType[],
    role: UserRole,
  ) {
    return (
      eligibleUserTypes.includes(RewardRuleUserType.ALL) ||
      eligibleUserTypes.includes(role as unknown as RewardRuleUserType)
    );
  }

  private withRewardRuleMetadata(
    metadata: Prisma.InputJsonValue | undefined,
    rule: {
      activityKey: string;
      ruleId: string | null;
      points: number;
      weeklyLimit: number | null;
    },
  ) {
    const base =
      metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : {};

    return {
      ...base,
      rewardRuleId: rule.ruleId,
      rewardRuleActivityKey: rule.activityKey,
      rewardRulePoints: rule.points,
      rewardRuleWeeklyLimit: rule.weeklyLimit,
    } satisfies Prisma.InputJsonValue;
  }

  private async ensureRewardAccount(userId: string) {
    return this.prisma.rewardAccount.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  private async ensureRewardAccountForTx(
    tx: Prisma.TransactionClient,
    userId: string,
  ) {
    return tx.rewardAccount.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  private async resolvePartnerStore(partnerUserId: string, storeId?: string) {
    if (storeId) {
      const store = await this.prisma.store.findFirst({
        where: { id: storeId, userId: partnerUserId },
      });

      if (!store) {
        throw new NotFoundException('Partner store not found');
      }

      return store;
    }

    return this.prisma.store.findFirst({ where: { userId: partnerUserId } });
  }

  private async getOwnedStore(partnerUserId: string, storeId: string) {
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, userId: partnerUserId },
    });

    if (!store) {
      throw new NotFoundException('Partner store not found');
    }

    return store;
  }

  private async resolvePartnerStoreIds(
    partnerUserId: string,
    storeIdsInput?: string,
    fallbackStoreId?: string,
  ) {
    const storeIds = this.parseStoreIds(storeIdsInput, fallbackStoreId);
    if (storeIds.length === 0) return [];

    const stores = await this.prisma.store.findMany({
      where: { id: { in: storeIds }, userId: partnerUserId },
      select: { id: true },
    });

    if (stores.length !== storeIds.length) {
      throw new NotFoundException(
        'One or more selected partner stores were not found',
      );
    }

    return storeIds;
  }

  private parseStoreIds(storeIdsInput?: string, fallbackStoreId?: string) {
    const rawIds: string[] = [];

    if (storeIdsInput?.trim()) {
      const value = storeIdsInput.trim();
      if (value.startsWith('[')) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(value);
        } catch {
          throw new BadRequestException('storeIds must be valid JSON array');
        }

        if (
          !Array.isArray(parsed) ||
          parsed.some((item) => typeof item !== 'string')
        ) {
          throw new BadRequestException('storeIds must be an array of strings');
        }

        rawIds.push(...(parsed as string[]));
      } else {
        rawIds.push(...value.split(','));
      }
    }

    if (fallbackStoreId?.trim()) {
      rawIds.push(fallbackStoreId);
    }

    return [...new Set(rawIds.map((id) => id.trim()).filter(Boolean))];
  }

  private async assertOfferExists(offerId: string) {
    const offer = await this.prisma.rewardOffer.findUnique({
      where: { id: offerId },
      select: { id: true },
    });

    if (!offer) {
      throw new NotFoundException('Reward offer not found');
    }
  }

  private offerWhere(status: RewardOfferStatus, now: Date) {
    return {
      status,
      OR: [{ availableQuantity: null }, { availableQuantity: { gt: 0 } }],
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    } satisfies Prisma.RewardOfferWhereInput;
  }

  private assertOfferRedeemable(
    offer: Prisma.RewardOfferGetPayload<{
      include: ReturnType<RewardsService['offerInclude']>;
    }>,
    now: Date,
  ) {
    if (offer.status !== RewardOfferStatus.ACTIVE) {
      throw new BadRequestException('Reward offer is not active');
    }

    if (offer.startsAt && offer.startsAt > now) {
      throw new BadRequestException('Reward offer has not started yet');
    }

    if (offer.endsAt && offer.endsAt < now) {
      throw new BadRequestException('Reward offer has expired');
    }

    if (offer.availableQuantity !== null && offer.availableQuantity <= 0) {
      throw new BadRequestException('Reward offer is sold out');
    }
  }

  private resolveClaimMethod(
    channel: RewardOfferChannel,
    requested?: RewardClaimMethod,
  ) {
    if (channel === RewardOfferChannel.ONLINE) {
      if (requested && requested !== RewardClaimMethod.ONLINE) {
        throw new BadRequestException('This offer is online only');
      }

      return RewardClaimMethod.ONLINE;
    }

    if (channel === RewardOfferChannel.IN_STORE) {
      if (requested && requested !== RewardClaimMethod.IN_STORE) {
        throw new BadRequestException('This offer is in-store only');
      }

      return RewardClaimMethod.IN_STORE;
    }

    if (!requested) {
      throw new BadRequestException(
        'claimMethod is required for offers available online and in-store',
      );
    }

    return requested;
  }

  private parseOfferLocations(locations?: string) {
    if (!locations?.trim()) return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(locations);
    } catch {
      throw new BadRequestException('locations must be a valid JSON array');
    }

    if (!Array.isArray(parsed)) {
      throw new BadRequestException('locations must be a JSON array');
    }

    return parsed.map((item, index) => {
      if (!item || typeof item !== 'object') {
        throw new BadRequestException(`locations[${index}] must be an object`);
      }

      const location = item as Record<string, unknown>;
      const name = this.stringFromUnknown(location.name)?.trim();
      if (!name) {
        throw new BadRequestException(`locations[${index}].name is required`);
      }

      return {
        name,
        address: this.stringFromUnknown(location.address)?.trim(),
        city: this.stringFromUnknown(location.city)?.trim(),
        latitude: this.numberFromUnknown(location.latitude),
        longitude: this.numberFromUnknown(location.longitude),
      };
    });
  }

  private offerInclude(userId?: string) {
    return {
      locations: {
        orderBy: { createdAt: 'asc' as const },
      },
      savedByUsers: {
        where: { userId: userId ?? '__no_current_reward_user__' },
        select: { id: true, userId: true },
      },
      stores: {
        include: {
          store: true,
        },
        orderBy: { createdAt: 'asc' as const },
      },
      partnerUser: {
        select: {
          id: true,
          fullName: true,
          email: true,
          profilePictureUrl: true,
        },
      },
      store: true,
    } satisfies Prisma.RewardOfferInclude;
  }

  private formatOffer(
    offer: Prisma.RewardOfferGetPayload<{
      include: ReturnType<RewardsService['offerInclude']>;
    }>,
  ) {
    const branchLocations = offer.stores.map((item) => ({
      id: item.store.id,
      storeId: item.store.id,
      name: item.store.name,
      address: item.store.address,
      city: item.store.city,
      latitude: item.store.latitude,
      longitude: item.store.longitude,
      mapUrl: item.store.mapUrl,
    }));
    const customLocations = offer.locations.map((location) => ({
      id: location.id,
      storeId: null,
      name: location.name,
      address: location.address,
      city: location.city,
      latitude: location.latitude,
      longitude: location.longitude,
      mapUrl: null,
    }));

    return {
      id: offer.id,
      title: offer.title,
      productName: offer.productName,
      description: offer.description,
      includedTitle: offer.includedTitle,
      includedDescription: offer.includedDescription,
      terms: offer.terms,
      imageUrl: offer.imageUrl,
      channel: offer.channel,
      onlineCouponCode: offer.onlineCouponCode,
      websiteUrl: offer.websiteUrl,
      pointsCost: offer.pointsCost,
      availableQuantity: offer.availableQuantity,
      redeemedCount: offer.redeemedCount,
      status: offer.status,
      startsAt: offer.startsAt,
      endsAt: offer.endsAt,
      isSaved: offer.savedByUsers.length > 0,
      locations: branchLocations.length > 0 ? branchLocations : customLocations,
      stores: offer.stores.map((item) => this.formatStore(item.store)),
      partner: offer.partnerUser,
      store: offer.store ? this.formatStore(offer.store) : null,
      createdAt: offer.createdAt,
      updatedAt: offer.updatedAt,
    };
  }

  private formatStore(store: Store) {
    return {
      id: store.id,
      name: store.name,
      logoUrl: store.logoUrl,
      description: store.description,
      address: store.address,
      city: store.city,
      latitude: store.latitude,
      longitude: store.longitude,
      mapUrl: store.mapUrl,
      createdAt: store.createdAt,
      updatedAt: store.updatedAt,
    };
  }

  private formatRedemption(
    redemption: Prisma.RewardRedemptionGetPayload<{
      include: {
        offer: { include: ReturnType<RewardsService['offerInclude']> };
      };
    }>,
    now: Date,
  ) {
    const isExpired =
      redemption.status === RewardRedemptionStatus.ACTIVE &&
      redemption.expiresAt < now;

    return {
      id: redemption.id,
      code: redemption.code,
      claimMethod: redemption.claimMethod,
      couponCode: redemption.couponCode,
      qrToken: redemption.qrToken,
      qrPayload: redemption.qrPayload,
      pointsSpent: redemption.pointsSpent,
      status: isExpired ? RewardRedemptionStatus.EXPIRED : redemption.status,
      redeemedAt: redemption.redeemedAt,
      expiresAt: redemption.expiresAt,
      expiresInDays: Math.max(
        0,
        Math.ceil(
          (redemption.expiresAt.getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      ),
      usedAt: redemption.usedAt,
      offer: this.formatOffer(redemption.offer),
      createdAt: redemption.createdAt,
      updatedAt: redemption.updatedAt,
    };
  }

  private formatRewardHubActivity(
    entry: RewardLedgerEntry,
    now: Date,
  ) {
    const metadata = this.objectMetadata(entry.metadata);

    return {
      id: entry.id,
      title:
        entry.description ||
        this.stringFromUnknown(metadata.title) ||
        this.defaultRewardActivityTitle(entry),
      subtitle: this.formatTimeAgo(entry.createdAt, now),
      points: entry.points,
      absolutePoints: Math.abs(entry.points),
      entryType: entry.entryType,
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
      childId: this.stringFromUnknown(metadata.childId) ?? null,
      childName: this.stringFromUnknown(metadata.childName) ?? null,
      metadata: entry.metadata,
      createdAt: entry.createdAt,
    };
  }

  private defaultRewardActivityTitle(entry: RewardLedgerEntry) {
    if (entry.entryType === RewardLedgerEntryType.SPEND) {
      return 'Redeemed reward offer';
    }

    switch (entry.sourceType) {
      case RewardLedgerSourceType.DAY_ACTIVITY:
        return 'Completed care activity';
      case RewardLedgerSourceType.CARE_MODULE_ASSIGNMENT:
        return 'Completed care module';
      case RewardLedgerSourceType.REWARD_REDEMPTION:
        return 'Reward redemption';
      default:
        return 'Earned care moment';
    }
  }

  private formatTimeAgo(date: Date, now: Date) {
    const diffMs = Math.max(0, now.getTime() - date.getTime());
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diffMs < minute) return 'Just now';
    if (diffMs < hour) {
      const minutes = Math.floor(diffMs / minute);
      return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    }
    if (diffMs < day) {
      const hours = Math.floor(diffMs / hour);
      return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    }

    const days = Math.floor(diffMs / day);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;

    return date.toISOString().slice(0, 10);
  }

  private objectMetadata(value: Prisma.JsonValue | null) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  private generateRedemptionCode() {
    return `ALR-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private generateQrToken() {
    return `QR-${randomBytes(12).toString('hex').toUpperCase()}`;
  }

  private stringFromUnknown(value: unknown) {
    return typeof value === 'string' ? value : undefined;
  }

  private numberFromUnknown(value: unknown) {
    if (value === null || value === undefined || value === '') return undefined;

    const number = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(number) ? number : undefined;
  }

  private ensureRewardUser(user: CurrentUserPayload) {
    if (user.role !== UserRole.NANNY && user.role !== UserRole.PARENT) {
      throw new ForbiddenException(
        'Only parent or nanny users can use rewards',
      );
    }
  }

  private ensurePartner(user: CurrentUserPayload) {
    if (user.role !== UserRole.PARTNER) {
      throw new ForbiddenException(
        'Only partner users can manage reward offers',
      );
    }
  }

  private currentUserId(user: CurrentUserPayload) {
    const userId = user.id ?? user.userId;
    if (!userId) {
      throw new BadRequestException('Authenticated user id is missing');
    }

    return userId;
  }
}
