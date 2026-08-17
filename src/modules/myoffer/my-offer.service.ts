import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PartnerOfferStatus,
  Prisma,
  RewardLedgerEntryType,
  RewardLedgerSourceType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  MyOfferQueryDto,
  MyOfferTabFilter,
  RedeemInStoreDto,
} from './dto/my-offer-query.dto';

@Injectable()
export class MyOfferService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Screen 1: Get active approved partner offers list (All or Saved)
   * Enforces date filter: startDate <= now AND endDate >= now
   */
  async getMyOffers(userId: string, query: MyOfferQueryDto) {
    const now = new Date();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    // Build base active & approved date filter
    const dateWhere: Prisma.PartnerOfferWhereInput = {
      status: PartnerOfferStatus.ACTIVE,
      AND: [
        {
          OR: [{ startDate: null }, { startDate: { lte: now } }],
        },
        {
          OR: [{ endDate: null }, { endDate: { gte: now } }],
        },
      ],
    };

    // Filter by saved tab if requested
    const savedWhere: Prisma.PartnerOfferWhereInput =
      query.tab === MyOfferTabFilter.SAVED
        ? { saves: { some: { userId } } }
        : {};

    // Search query filter
    const searchWhere: Prisma.PartnerOfferWhereInput = query.search?.trim()
      ? {
          OR: [
            { title: { contains: query.search.trim(), mode: 'insensitive' } },
            { description: { contains: query.search.trim(), mode: 'insensitive' } },
            {
              partnerUser: {
                fullName: { contains: query.search.trim(), mode: 'insensitive' },
              },
            },
          ],
        }
      : {};

    const where: Prisma.PartnerOfferWhereInput = {
      ...dateWhere,
      ...savedWhere,
      ...searchWhere,
    };

    const [total, offers] = await Promise.all([
      this.prisma.partnerOffer.count({ where }),
      this.prisma.partnerOffer.findMany({
        where,
        include: {
          partnerUser: {
            select: {
              id: true,
              fullName: true,
              profilePictureUrl: true,
            },
          },
          saves: {
            where: { userId },
            select: { id: true },
          },
        },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    const formattedOffers = offers.map((offer) =>
      this.formatOfferSummary(offer, userId),
    );

    return {
      success: true,
      data: formattedOffers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Screen 2: Get single offer details page
   * Returns full offer information including What's Included, Terms, and Available Locations
   */
  async getMyOfferDetails(userId: string, offerId: string) {
    const now = new Date();

    const offer = await this.prisma.partnerOffer.findUnique({
      where: { id: offerId },
      include: {
        partnerUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
            profilePictureUrl: true,
          },
        },
        locations: {
          orderBy: { createdAt: 'asc' },
        },
        saves: {
          where: { userId },
          select: { id: true },
        },
      },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    if (offer.status !== PartnerOfferStatus.ACTIVE) {
      throw new BadRequestException('This offer is not currently active');
    }

    if (offer.startDate && offer.startDate > now) {
      throw new BadRequestException('This offer has not started yet');
    }

    if (offer.endDate && offer.endDate < now) {
      throw new BadRequestException('This offer has expired');
    }

    // Record view asynchronously
    this.prisma.partnerOfferView
      .create({
        data: {
          offerId: offer.id,
          userId,
        },
      })
      .catch(() => {});

    // Fetch user reward account balance
    const userAccount = await this.prisma.rewardAccount.findUnique({
      where: { userId },
      select: { balance: true },
    });

    const userPointsBalance = userAccount?.balance ?? 0;
    const canRedeem = userPointsBalance >= offer.requiredAlurei;

    return {
      success: true,
      data: {
        id: offer.id,
        title: offer.title,
        description: offer.description ?? offer.benefitTitle ?? '',
        heroImageUrl:
          offer.heroImageUrl ??
          'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
        partner: {
          id: offer.partnerUser.id,
          name: offer.partnerUser.fullName,
          logoUrl: offer.partnerUser.profilePictureUrl,
          email: offer.partnerUser.email,
          phone: offer.partnerUser.phoneNumber,
        },
        requiredAlurei: offer.requiredAlurei,
        requiredPointsLabel: `${offer.requiredAlurei} ALR`,
        redemptionFlow: offer.redemptionFlow,
        redemptionFlowLabel:
          offer.redemptionFlow === 'IN_STORE' ? 'In-store' : 'Online',
        startDate: offer.startDate,
        endDate: offer.endDate,
        formattedExpiry: this.formatExpiryDate(offer.endDate),
        whatsIncluded: {
          benefitTitle:
            offer.benefitTitle ??
            `Grab ${offer.deductionPercentage ? offer.deductionPercentage + '%' : ''} discount with ${offer.requiredAlurei} Alurei`,
          benefitDescription:
            offer.benefitDescription ??
            offer.description ??
            `AED ${offer.minimumSpend ?? 30} Instant Discount. Applied directly at checkout on your total bill.`,
          minimumSpend: offer.minimumSpend ? Number(offer.minimumSpend) : null,
          deductionPercentage: offer.deductionPercentage
            ? Number(offer.deductionPercentage)
            : null,
        },
        termsAndConditions:
          offer.terms ??
          `AED ${offer.minimumSpend ?? 30} Instant Discount. Applied directly at checkout on your total bill. Points non-refundable once redeemed.`,
        availableLocations: offer.locations.map((loc) => ({
          id: loc.id,
          name: loc.name,
          address: loc.address ?? `${loc.name}, ${loc.city ?? ''}`.trim(),
          city: loc.city,
          mapUrl: loc.mapUrl,
          latitude: loc.latitude,
          longitude: loc.longitude,
        })),
        isSaved: offer.saves.length > 0,
        userPointsBalance,
        canRedeem,
      },
    };
  }

  /**
   * Bookmark / Toggle Save status for an offer
   */
  async toggleSaveOffer(userId: string, offerId: string) {
    const offer = await this.prisma.partnerOffer.findUnique({
      where: { id: offerId },
      select: { id: true },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    const existingSave = await this.prisma.partnerOfferSave.findUnique({
      where: {
        offerId_userId: {
          offerId,
          userId,
        },
      },
    });

    if (existingSave) {
      await this.prisma.partnerOfferSave.delete({
        where: { id: existingSave.id },
      });

      return {
        success: true,
        isSaved: false,
        message: 'Offer removed from bookmarks',
      };
    }

    await this.prisma.partnerOfferSave.create({
      data: {
        offerId,
        userId,
      },
    });

    return {
      success: true,
      isSaved: true,
      message: 'Offer saved to bookmarks successfully! 🎉',
    };
  }

  /**
   * In-Store QR verification & Points Redemption Flow
   * Matches Screen 1 (QR Scanner) -> Screen 2 (Redemption success)
   */
  async redeemInStoreOffer(
    userId: string,
    offerId: string,
    dto?: RedeemInStoreDto,
  ) {
    const now = new Date();

    const offer = await this.prisma.partnerOffer.findUnique({
      where: { id: offerId },
      include: {
        partnerUser: {
          select: {
            fullName: true,
            profilePictureUrl: true,
          },
        },
      },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    if (offer.status !== PartnerOfferStatus.ACTIVE) {
      throw new BadRequestException('This offer is not currently active');
    }

    if (offer.startDate && offer.startDate > now) {
      throw new BadRequestException('This offer has not started yet');
    }

    if (offer.endDate && offer.endDate < now) {
      throw new BadRequestException('This offer has expired');
    }

    // Get or create user reward account
    let account = await this.prisma.rewardAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      account = await this.prisma.rewardAccount.create({
        data: { userId, balance: 0 },
      });
    }

    if (account.balance < offer.requiredAlurei) {
      throw new BadRequestException(
        `Insufficient ALR points balance. You have ${account.balance} ALR, but ${offer.requiredAlurei} ALR is required.`,
      );
    }

    const redemptionCode = `ALR-${offer.id.slice(0, 5).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Execute atomic transaction for points deduction and redemption
    const result = await this.prisma.$transaction(async (tx) => {
      // Deduct ALR points
      const updatedAccount = await tx.rewardAccount.update({
        where: { id: account.id },
        data: {
          balance: { decrement: offer.requiredAlurei },
          lifetimeSpent: { increment: offer.requiredAlurei },
        },
      });

      // Create redemption record
      const redemption = await tx.partnerOfferRedemption.create({
        data: {
          offerId: offer.id,
          userId,
        },
      });

      // Create ledger spend entry
      await tx.rewardLedgerEntry.create({
        data: {
          userId,
          entryType: RewardLedgerEntryType.SPEND,
          sourceType: RewardLedgerSourceType.REWARD_REDEMPTION,
          sourceId: redemption.id,
          points: -offer.requiredAlurei,
          balanceAfter: updatedAccount.balance,
          description: `Redeemed offer: ${offer.title}`,
        },
      });

      return { redemption, updatedAccount };
    });

    return {
      success: true,
      message: 'Offer Redeemed Successfully',
      data: {
        redemptionId: result.redemption.id,
        offerId: offer.id,
        offerTitle: offer.title,
        partnerName: offer.partnerUser.fullName,
        partnerLogoUrl: offer.partnerUser.profilePictureUrl,
        redeemedPoints: offer.requiredAlurei,
        redeemedPointsLabel: `${offer.requiredAlurei} ALR`,
        title: 'Offer Redeemed Successfully',
        subtitle: `You've successfully redeemed ${offer.requiredAlurei} ALR.`,
        remainingPointsBalance: result.updatedAccount.balance,
        redemptionCode,
        redeemedAt: result.redemption.createdAt,
      },
    };
  }

  /**
   * Get all redeemed rewards for logged-in user ("Visit my rewards" screen)
   */
  async getMyRedeemedRewards(userId: string) {
    const redemptions = await this.prisma.partnerOfferRedemption.findMany({
      where: { userId },
      include: {
        offer: {
          include: {
            partnerUser: {
              select: {
                fullName: true,
                profilePictureUrl: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: redemptions.map((item) => ({
        redemptionId: item.id,
        offerId: item.offer.id,
        offerTitle: item.offer.title,
        description: item.offer.description ?? item.offer.benefitTitle,
        heroImageUrl: item.offer.heroImageUrl,
        partnerName: item.offer.partnerUser.fullName,
        partnerLogoUrl: item.offer.partnerUser.profilePictureUrl,
        redeemedPoints: item.offer.requiredAlurei,
        redeemedPointsLabel: `${item.offer.requiredAlurei} ALR`,
        redemptionFlow: item.offer.redemptionFlow,
        redeemedAt: item.createdAt,
        redemptionCode: `ALR-${item.offer.id.slice(0, 5).toUpperCase()}-${item.id.slice(0, 4).toUpperCase()}`,
      })),
    };
  }

  /**
   * Helper to format summary for offer card listing
   */
  private formatOfferSummary(offer: any, userId: string) {
    return {
      id: offer.id,
      title: offer.title,
      description:
        offer.description ??
        offer.benefitTitle ??
        `Grab discount with ${offer.requiredAlurei} Alurei`,
      heroImageUrl:
        offer.heroImageUrl ??
        'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80',
      partner: {
        id: offer.partnerUser.id,
        name: offer.partnerUser.fullName,
        logoUrl: offer.partnerUser.profilePictureUrl,
      },
      requiredAlurei: offer.requiredAlurei,
      requiredPointsLabel: `${offer.requiredAlurei} ALR`,
      redemptionFlow: offer.redemptionFlow,
      redemptionFlowLabel:
        offer.redemptionFlow === 'IN_STORE' ? 'In-store' : 'Online',
      startDate: offer.startDate,
      endDate: offer.endDate,
      formattedExpiry: this.formatExpiryDate(offer.endDate),
      isSaved: offer.saves ? offer.saves.length > 0 : false,
    };
  }

  /**
   * Format expiration date string (e.g. "Expires Jan 20, 2025")
   */
  private formatExpiryDate(date: Date | null): string {
    if (!date) return 'No expiration date';
    const months = [
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
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    return `Expires ${month} ${day}, ${year}`;
  }
}
