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
import {
  RewardLedgerQueryDto,
  RewardOfferQueryDto,
} from './dto/reward-query.dto';
import { RedeemRewardOfferDto } from './dto/redeem-reward-offer.dto';
import { UpdateRewardOfferDto } from './dto/update-reward-offer.dto';
import { UseRedemptionDto } from './dto/use-redemption.dto';

const POINTS_PER_COMPLETED_TASK = 2;
const REDEMPTION_EXPIRY_DAYS = 180;
const DAILY_FLOW_REWARD_RULE_KEY = 'COMPLETE_DAILY_FLOW';
const CARE_MODULE_REWARD_RULE_KEY = 'COMPLETE_CARE_MODULE';

@Injectable()
export class RewardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caregiverService: CaregiverService,
    private readonly storageService: StorageService,
  ) {}

  async getMySummary(user: CurrentUserPayload) {
    const userId = this.currentUserId(user);
    const account = await this.ensureRewardAccount(userId);

    return {
      success: true,
      message: 'Reward summary fetched successfully',
      data: {
        balance: account.balance,
        lifetimeEarned: account.lifetimeEarned,
        lifetimeSpent: account.lifetimeSpent,
        pointsPerCompletedTask: POINTS_PER_COMPLETED_TASK,
        redemptionExpiresInDays: REDEMPTION_EXPIRY_DAYS,
      },
    };
  }

  async getMyLedger(user: CurrentUserPayload, query: RewardLedgerQueryDto) {
    const userId = this.currentUserId(user);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = {
      userId,
      ...(query.entryType && { entryType: query.entryType }),
    } satisfies Prisma.RewardLedgerEntryWhereInput;

    const [items, total] = await Promise.all([
      this.prisma.rewardLedgerEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.rewardLedgerEntry.count({ where }),
    ]);

    return {
      success: true,
      message: 'Reward ledger fetched successfully',
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getOffers(user: CurrentUserPayload, query: RewardOfferQueryDto) {
    const userId = this.currentUserId(user);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const now = new Date();
    const where = this.offerWhere(
      query.status ?? RewardOfferStatus.ACTIVE,
      now,
    );

    const [offers, total] = await Promise.all([
      this.prisma.rewardOffer.findMany({
        where,
        include: this.offerInclude(userId),
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.rewardOffer.count({ where }),
    ]);

    return {
      success: true,
      message: 'Reward offers fetched successfully',
      data: offers.map((offer) => this.formatOffer(offer)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getSavedOffers(user: CurrentUserPayload, query: RewardOfferQueryDto) {
    const userId = this.currentUserId(user);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const now = new Date();
    const where = {
      ...this.offerWhere(query.status ?? RewardOfferStatus.ACTIVE, now),
      savedByUsers: { some: { userId } },
    } satisfies Prisma.RewardOfferWhereInput;

    const [offers, total] = await Promise.all([
      this.prisma.rewardOffer.findMany({
        where,
        include: this.offerInclude(userId),
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.rewardOffer.count({ where }),
    ]);

    return {
      success: true,
      message: 'Saved reward offers fetched successfully',
      data: offers.map((offer) => this.formatOffer(offer)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getOfferDetail(user: CurrentUserPayload, offerId: string) {
    const userId = this.currentUserId(user);
    const offer = await this.prisma.rewardOffer.findUnique({
      where: { id: offerId },
      include: this.offerInclude(userId),
    });

    if (!offer) {
      throw new NotFoundException('Reward offer not found');
    }

    return {
      success: true,
      message: 'Reward offer fetched successfully',
      data: this.formatOffer(offer),
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

  async redeemOffer(
    user: CurrentUserPayload,
    offerId: string,
    dto: RedeemRewardOfferDto,
  ) {
    this.ensureRewardUser(user);
    const userId = this.currentUserId(user);
    const now = new Date();

    const redemption = await this.prisma.$transaction(async (tx) => {
      await this.ensureRewardAccountForTx(tx, userId);

      const offer = await tx.rewardOffer.findUnique({
        where: { id: offerId },
        include: this.offerInclude(userId),
      });

      if (!offer) {
        throw new NotFoundException('Reward offer not found');
      }

      this.assertOfferRedeemable(offer, now);
      const claimMethod = this.resolveClaimMethod(
        offer.channel,
        dto.claimMethod,
      );

      if (claimMethod === RewardClaimMethod.IN_STORE && dto.storeId) {
        const allowedStoreIds = new Set([
          ...(offer.storeId ? [offer.storeId] : []),
          ...offer.stores.map((item) => item.storeId),
        ]);

        if (!allowedStoreIds.has(dto.storeId)) {
          throw new BadRequestException(
            'Selected store is not available for this offer',
          );
        }
      }

      const updatedAccount = await tx.rewardAccount.updateMany({
        where: {
          userId,
          balance: { gte: offer.pointsCost },
        },
        data: {
          balance: { decrement: offer.pointsCost },
          lifetimeSpent: { increment: offer.pointsCost },
        },
      });

      if (updatedAccount.count === 0) {
        throw new BadRequestException('Not enough reward points');
      }

      const account = await tx.rewardAccount.findUniqueOrThrow({
        where: { userId },
      });

      const stockUpdate = await tx.rewardOffer.updateMany({
        where: {
          id: offer.id,
          status: RewardOfferStatus.ACTIVE,
          OR: [{ availableQuantity: null }, { availableQuantity: { gt: 0 } }],
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          ],
        },
        data: {
          redeemedCount: { increment: 1 },
          ...(offer.availableQuantity !== null && {
            availableQuantity: { decrement: 1 },
          }),
        },
      });

      if (stockUpdate.count === 0) {
        throw new BadRequestException('Reward offer is no longer available');
      }

      const code = this.generateRedemptionCode();
      const qrToken =
        claimMethod === RewardClaimMethod.IN_STORE
          ? this.generateQrToken()
          : null;
      const couponCode =
        claimMethod === RewardClaimMethod.ONLINE
          ? offer.onlineCouponCode?.trim() || code
          : null;
      const qrPayload = qrToken
        ? JSON.stringify({
            type: 'ALUREI_REWARD_REDEMPTION',
            qrToken,
            offerId: offer.id,
          })
        : null;

      const created = await tx.rewardRedemption.create({
        data: {
          userId,
          offerId: offer.id,
          code,
          claimMethod,
          couponCode,
          qrToken,
          qrPayload,
          pointsSpent: offer.pointsCost,
          redeemedAt: now,
          expiresAt: this.addDays(now, REDEMPTION_EXPIRY_DAYS),
        },
        include: { offer: { include: this.offerInclude(userId) } },
      });

      await tx.rewardLedgerEntry.create({
        data: {
          userId,
          entryType: RewardLedgerEntryType.SPEND,
          sourceType: RewardLedgerSourceType.REWARD_REDEMPTION,
          sourceId: created.id,
          points: -offer.pointsCost,
          balanceAfter: account.balance,
          description: `Redeemed ${offer.productName}`,
          metadata: {
            offerId: offer.id,
            code: created.code,
            claimMethod,
            couponCode,
            qrToken,
          },
        },
      });

      return created;
    });

    return {
      success: true,
      message: 'Reward offer redeemed successfully',
      data: this.formatRedemption(redemption, now),
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

  async saveOffer(user: CurrentUserPayload, offerId: string) {
    this.ensureRewardUser(user);
    const userId = this.currentUserId(user);
    await this.assertOfferExists(offerId);

    const saved = await this.prisma.rewardSavedOffer.upsert({
      where: { userId_offerId: { userId, offerId } },
      update: {},
      create: { userId, offerId },
      include: { offer: { include: this.offerInclude(userId) } },
    });

    return {
      success: true,
      message: 'Reward offer saved successfully',
      data: this.formatOffer(saved.offer),
    };
  }

  async unsaveOffer(user: CurrentUserPayload, offerId: string) {
    this.ensureRewardUser(user);
    const userId = this.currentUserId(user);

    await this.prisma.rewardSavedOffer.deleteMany({
      where: { userId, offerId },
    });

    return {
      success: true,
      message: 'Reward offer removed from saved list successfully',
      data: { offerId },
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
    if (user.role === UserRole.PARTNER) {
      return this.useRedemption(user, dto);
    }

    if (user.role === UserRole.PARENT || user.role === UserRole.NANNY) {
      if (!dto.offerId) {
        throw new BadRequestException('offerId is required for in-store claim');
      }

      return this.redeemOffer(user, dto.offerId, {
        claimMethod: RewardClaimMethod.IN_STORE,
        storeId: dto.storeId,
      });
    }

    throw new ForbiddenException('Only parent, nanny, or partner can use scan');
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
