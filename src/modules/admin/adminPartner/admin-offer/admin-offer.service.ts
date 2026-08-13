import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PartnerOfferStatus,
  PartnerOfferType,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { StorageService } from '../../../../common/storage/storage.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  AdminOfferPartnerQueryDto,
  CreateAdminPartnerOfferDto,
} from './dto/admin-offer.dto';

@Injectable()
export class AdminOfferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async getPartnerOptions(query: AdminOfferPartnerQueryDto) {
    const search = query.search?.trim();
    const take = Math.min(Math.max(query.limit ?? 20, 1), 50);

    const partners = await this.prisma.user.findMany({
      where: {
        role: UserRole.PARTNER,
        status: { not: UserStatus.DELETED },
        ...(search && {
          OR: [
            { fullName: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
            {
              partnerProfile: {
                businessName: {
                  contains: search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            },
            {
              partnerProfile: {
                businessCategory: {
                  contains: search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            },
          ],
        }),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        profilePictureUrl: true,
        status: true,
        partnerProfile: {
          select: {
            businessName: true,
            businessCategory: true,
            city: true,
            country: true,
          },
        },
      },
      orderBy: { fullName: 'asc' },
      take,
    });

    return {
      success: true,
      message: 'Partner options fetched successfully.',
      data: partners.map((partner) => ({
        id: partner.id,
        name: partner.partnerProfile?.businessName ?? partner.fullName,
        email: partner.email,
        image: partner.profilePictureUrl,
        status: partner.status,
        category: partner.partnerProfile?.businessCategory ?? null,
        city: partner.partnerProfile?.city ?? null,
        country: partner.partnerProfile?.country ?? null,
      })),
    };
  }

  async getPartnerLocations(partnerUserId: string) {
    await this.assertPartner(partnerUserId);

    const locations = await this.prisma.store.findMany({
      where: { userId: partnerUserId },
      orderBy: [{ city: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        mapUrl: true,
        latitude: true,
        longitude: true,
      },
    });

    return {
      success: true,
      message: 'Partner locations fetched successfully.',
      data: locations.map((location) => ({
        storeId: location.id,
        name: location.name,
        address: location.address,
        city: location.city,
        mapUrl: location.mapUrl,
        latitude: location.latitude,
        longitude: location.longitude,
      })),
    };
  }

  async createOffer(
    admin: CurrentUserPayload,
    dto: CreateAdminPartnerOfferDto,
    image?: Express.Multer.File,
  ) {
    await this.assertPartner(dto.partnerUserId);
    await this.validateOfferPayload(dto);
    await this.validateLocations(dto);

    const status = dto.status ?? PartnerOfferStatus.ACTIVE;
    const now = new Date();
    const uploadedHeroImageUrl =
      image && !dto.useDefaultHeroImage
        ? await this.storageService.uploadFile(image, 'partner-offers')
        : null;
    const offer = await this.prisma.partnerOffer.create({
      data: {
        ...this.offerData(dto, uploadedHeroImageUrl),
        partnerUserId: dto.partnerUserId,
        redemptionFlow: dto.redemptionFlow,
        offerType: dto.offerType,
        title: dto.title.trim(),
        requiredAlurei: dto.requiredAlurei,
        status,
        ...(status === PartnerOfferStatus.ACTIVE && {
          reviewedByUserId: this.currentUserId(admin),
          reviewedAt: now,
          publishedAt: now,
        }),
        locations: {
          create: this.locationData(dto),
        },
      },
      include: this.offerInclude(),
    });

    return {
      success: true,
      message:
        status === PartnerOfferStatus.DRAFT
          ? 'Admin partner offer draft saved successfully.'
          : 'Admin partner offer created successfully.',
      data: this.formatOffer(offer),
    };
  }

  private async assertPartner(partnerUserId: string) {
    const partner = await this.prisma.user.findFirst({
      where: {
        id: partnerUserId,
        role: UserRole.PARTNER,
        status: { not: UserStatus.DELETED },
      },
      select: { id: true },
    });

    if (!partner) {
      throw new NotFoundException('Partner not found.');
    }
  }

  private async validateOfferPayload(dto: CreateAdminPartnerOfferDto) {
    if (dto.startDate && dto.endDate) {
      const startDate = new Date(dto.startDate);
      const endDate = new Date(dto.endDate);
      if (startDate > endDate) {
        throw new BadRequestException('startDate must be before endDate.');
      }
    }

    if (
      dto.offerType === PartnerOfferType.PRODUCT_BASED &&
      !dto.productId &&
      !dto.productName &&
      !dto.category
    ) {
      throw new BadRequestException(
        'productId, productName, or category is required for product based offers.',
      );
    }

    if (dto.productId) {
      const product = await this.prisma.partnerProduct.findFirst({
        where: { id: dto.productId, partnerUserId: dto.partnerUserId },
        select: { id: true },
      });

      if (!product) {
        throw new NotFoundException('Selected product not found for partner.');
      }
    }
  }

  private async validateLocations(dto: CreateAdminPartnerOfferDto) {
    const storeIds = [
      ...new Set((dto.locations ?? []).map((item) => item.storeId).filter(Boolean)),
    ] as string[];

    if (storeIds.length === 0) return;

    const stores = await this.prisma.store.findMany({
      where: { id: { in: storeIds }, userId: dto.partnerUserId },
      select: { id: true },
    });

    if (stores.length !== storeIds.length) {
      throw new NotFoundException(
        'One or more selected locations do not belong to this partner.',
      );
    }
  }

  private offerData(
    dto: CreateAdminPartnerOfferDto,
    uploadedHeroImageUrl?: string | null,
  ) {
    return {
      description: dto.description?.trim() || null,
      heroImageUrl: dto.useDefaultHeroImage
        ? null
        : uploadedHeroImageUrl ?? null,
      useDefaultHeroImage: dto.useDefaultHeroImage ?? false,
      productId: dto.productId?.trim() || null,
      productName: dto.productName?.trim() || null,
      category: dto.category,
      minimumSpend:
        dto.minimumSpend === undefined
          ? undefined
          : new Prisma.Decimal(dto.minimumSpend),
      deductionPercentage:
        dto.deductionPercentage === undefined
          ? undefined
          : new Prisma.Decimal(dto.deductionPercentage),
      eligiblePlans: dto.eligiblePlans ?? [],
      benefitTitle: dto.benefitTitle?.trim() || null,
      benefitDescription: dto.benefitDescription?.trim() || null,
      terms: dto.terms?.trim() || null,
      availableAllOutlets: dto.availableAllOutlets ?? false,
      recommendExternal: dto.recommendExternal ?? false,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
    } satisfies Partial<Prisma.PartnerOfferUncheckedCreateInput>;
  }

  private locationData(dto: CreateAdminPartnerOfferDto) {
    return (dto.locations ?? []).map((location) => ({
      storeId: location.storeId?.trim() || null,
      name: location.name.trim(),
      address: location.address?.trim() || null,
      city: location.city?.trim() || null,
      mapUrl: location.mapUrl?.trim() || null,
      latitude: location.latitude,
      longitude: location.longitude,
    }));
  }

  private offerInclude() {
    return {
      locations: { orderBy: { createdAt: 'asc' as const } },
      partnerUser: {
        select: {
          id: true,
          fullName: true,
          email: true,
          profilePictureUrl: true,
          partnerProfile: {
            select: {
              businessName: true,
              businessCategory: true,
            },
          },
        },
      },
      partnerProduct: true,
    } satisfies Prisma.PartnerOfferInclude;
  }

  private formatOffer(
    offer: Prisma.PartnerOfferGetPayload<{
      include: ReturnType<AdminOfferService['offerInclude']>;
    }>,
  ) {
    return {
      id: offer.id,
      partnerUserId: offer.partnerUserId,
      partner: {
        id: offer.partnerUser.id,
        name:
          offer.partnerUser.partnerProfile?.businessName ??
          offer.partnerUser.fullName,
        email: offer.partnerUser.email,
        image: offer.partnerUser.profilePictureUrl,
        category: offer.partnerUser.partnerProfile?.businessCategory ?? null,
      },
      redemptionFlow: offer.redemptionFlow,
      offerType: offer.offerType,
      title: offer.title,
      description: offer.description,
      heroImageUrl: offer.heroImageUrl,
      useDefaultHeroImage: offer.useDefaultHeroImage,
      productId: offer.productId,
      productName: offer.productName,
      category: offer.category,
      minimumSpend:
        offer.minimumSpend === null ? null : Number(offer.minimumSpend),
      deductionPercentage:
        offer.deductionPercentage === null
          ? null
          : Number(offer.deductionPercentage),
      requiredAlurei: offer.requiredAlurei,
      eligiblePlans: offer.eligiblePlans,
      benefitTitle: offer.benefitTitle,
      benefitDescription: offer.benefitDescription,
      terms: offer.terms,
      availableAllOutlets: offer.availableAllOutlets,
      recommendExternal: offer.recommendExternal,
      startDate: offer.startDate,
      endDate: offer.endDate,
      status: offer.status,
      reviewedByUserId: offer.reviewedByUserId,
      reviewedAt: offer.reviewedAt,
      publishedAt: offer.publishedAt,
      locations: offer.locations.map((location) => ({
        id: location.id,
        storeId: location.storeId,
        name: location.name,
        address: location.address,
        city: location.city,
        mapUrl: location.mapUrl,
        latitude: location.latitude,
        longitude: location.longitude,
      })),
      createdAt: offer.createdAt,
      updatedAt: offer.updatedAt,
    };
  }

  private currentUserId(user: CurrentUserPayload) {
    const userId = user.id ?? user.userId;
    if (!userId) {
      throw new BadRequestException('Authenticated user id is missing.');
    }

    return userId;
  }
}
