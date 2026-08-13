import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  PartnerOfferStatus,
  PartnerOfferType,
  Prisma,
  UserRole,
} from '@prisma/client';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import sharp from 'sharp';
import type { CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { NotificationService } from '../../notification/notification.service';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreatePartnerOfferDto,
  PartnerOfferLocationDto,
  PartnerOfferQueryDto,
  RejectPartnerOfferDto,
  UpdatePartnerOfferDto,
} from './dto/partner-offer.dto';

@Injectable()
export class PartnerOfferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async createOffer(user: CurrentUserPayload, dto: CreatePartnerOfferDto) {
    this.ensurePartner(user);
    const partnerUserId = this.currentUserId(user);
    const status = dto.status ?? PartnerOfferStatus.PENDING_APPROVAL;

    await this.validateOfferPayload(partnerUserId, dto);
    await this.validateLocations(partnerUserId, dto.locations);

    const offer = await this.prisma.partnerOffer.create({
      data: {
        ...this.offerData(dto),
        partnerUserId,
        redemptionFlow: dto.redemptionFlow,
        offerType: dto.offerType,
        title: dto.title.trim(),
        requiredAlurei: dto.requiredAlurei,
        status,
        locations: {
          create: this.locationData(dto.locations),
        },
      },
      include: this.offerInclude(),
    });

    return {
      success: true,
      message:
        status === PartnerOfferStatus.DRAFT
          ? 'Partner offer draft saved successfully'
          : 'Partner offer submitted for admin review successfully',
      data: this.formatOffer(offer),
    };
  }

  async getMyOffers(user: CurrentUserPayload, query: PartnerOfferQueryDto) {
    this.ensurePartner(user);
    const partnerUserId = this.currentUserId(user);
    return this.getOffers({
      ...query,
      partnerUserId,
    });
  }

  async getOffersForUser(
    user: CurrentUserPayload,
    query: PartnerOfferQueryDto,
  ) {
    if (user.role === UserRole.PARTNER) {
      return this.getMyOffers(user, query);
    }

    return this.getOffers({
      ...query,
      publicOnly: true,
    });
  }

  async getMyOutlets(
    user: CurrentUserPayload,
    query: { search?: string; limit?: number },
  ) {
    this.ensurePartner(user);
    const partnerUserId = this.currentUserId(user);
    const search = query.search?.trim();
    const limit = Math.min(Math.max(query.limit ?? 10, 1), 50);

    const outlets = await this.prisma.store.findMany({
      where: {
        userId: partnerUserId,
        ...(search && {
          OR: [
            {
              name: {
                contains: search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              address: {
                contains: search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              city: {
                contains: search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
          ],
        }),
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    return {
      success: true,
      message: 'Partner outlet locations fetched successfully',
      data: outlets.map((outlet) => ({
        id: outlet.id,
        storeId: outlet.id,
        name: outlet.name,
        address: outlet.address,
        city: outlet.city,
        mapUrl: outlet.mapUrl,
        latitude: outlet.latitude,
        longitude: outlet.longitude,
        createdAt: outlet.createdAt,
        updatedAt: outlet.updatedAt,
      })),
    };
  }

  async getMyOffer(user: CurrentUserPayload, offerId: string) {
    this.ensurePartner(user);
    const partnerUserId = this.currentUserId(user);
    const offer = await this.prisma.partnerOffer.findFirst({
      where: { id: offerId, partnerUserId },
      include: this.offerInclude(),
    });

    if (!offer) {
      throw new NotFoundException('Partner offer not found');
    }

    return {
      success: true,
      message: 'Partner offer fetched successfully',
      data: this.formatOffer(offer),
    };
  }

  async getOfferForUser(user: CurrentUserPayload, offerId: string) {
    if (user.role === UserRole.PARTNER) {
      return this.getMyOffer(user, offerId);
    }

    const offer = await this.prisma.partnerOffer.findFirst({
      where: {
        id: offerId,
        ...this.publicOfferWhere(),
      },
      include: this.offerInclude(),
    });

    if (!offer) {
      throw new NotFoundException('Partner offer not found');
    }

    return {
      success: true,
      message: 'Partner offer fetched successfully',
      data: this.formatOffer(offer),
    };
  }

  async updateMyOffer(
    user: CurrentUserPayload,
    offerId: string,
    dto: UpdatePartnerOfferDto,
  ) {
    this.ensurePartner(user);
    const partnerUserId = this.currentUserId(user);
    const existing = await this.prisma.partnerOffer.findFirst({
      where: { id: offerId, partnerUserId },
      include: { locations: true },
    });

    if (!existing) {
      throw new NotFoundException('Partner offer not found');
    }

    if (existing.status === PartnerOfferStatus.ACTIVE) {
      throw new BadRequestException(
        'Published offers cannot be edited by partner',
      );
    }

    const merged = {
      ...existing,
      ...dto,
    } as CreatePartnerOfferDto;

    await this.validateOfferPayload(partnerUserId, merged);
    if (dto.locations !== undefined) {
      await this.validateLocations(partnerUserId, dto.locations);
    }

    const nextStatus =
      dto.status === PartnerOfferStatus.PENDING_APPROVAL
        ? PartnerOfferStatus.PENDING_APPROVAL
        : dto.status;

    const offer = await this.prisma.partnerOffer.update({
      where: { id: offerId },
      data: {
        ...this.offerData(dto),
        ...(nextStatus !== undefined && {
          status: nextStatus,
          rejectionReason: null,
          reviewedByUserId: null,
          reviewedAt: null,
        }),
        ...(dto.locations !== undefined && {
          locations: {
            deleteMany: {},
            create: this.locationData(dto.locations),
          },
        }),
      },
      include: this.offerInclude(),
    });

    return {
      success: true,
      message:
        offer.status === PartnerOfferStatus.PENDING_APPROVAL
          ? 'Partner offer submitted for admin review successfully'
          : 'Partner offer updated successfully',
      data: this.formatOffer(offer),
    };
  }

  async getAdminOffers(query: PartnerOfferQueryDto) {
    return this.getOffers(query);
  }

  async getAdminOffer(offerId: string) {
    const offer = await this.prisma.partnerOffer.findUnique({
      where: { id: offerId },
      include: this.offerInclude(),
    });

    if (!offer) {
      throw new NotFoundException('Partner offer not found');
    }

    return {
      success: true,
      message: 'Partner offer fetched successfully',
      data: this.formatOffer(offer),
    };
  }

  async approveOffer(admin: CurrentUserPayload, offerId: string) {
    const existing = await this.assertOfferExists(offerId);

    if (existing.status === PartnerOfferStatus.ACTIVE) {
      throw new BadRequestException('Partner offer is already approved');
    }

    if (existing.status === PartnerOfferStatus.REJECTED) {
      throw new BadRequestException(
        'Rejected offers must be resubmitted before approval',
      );
    }

    const now = new Date();
    const offer = await this.prisma.partnerOffer.update({
      where: { id: offerId },
      data: {
        status: PartnerOfferStatus.ACTIVE,
        rejectionReason: null,
        reviewedByUserId: this.currentUserId(admin),
        reviewedAt: now,
        publishedAt: now,
      },
      include: this.offerInclude(),
    });

    await this.notifyPartnerOfferApproved(offer);

    return {
      success: true,
      message: 'Partner offer approved and published successfully',
      data: this.formatOffer(offer),
    };
  }

  async rejectOffer(
    admin: CurrentUserPayload,
    offerId: string,
    dto: RejectPartnerOfferDto,
  ) {
    const existing = await this.assertOfferExists(offerId);

    if (existing.status === PartnerOfferStatus.ACTIVE) {
      throw new BadRequestException(
        'Published offers cannot be rejected. Set them inactive instead.',
      );
    }

    const offer = await this.prisma.partnerOffer.update({
      where: { id: offerId },
      data: {
        status: PartnerOfferStatus.REJECTED,
        rejectionReason: dto.reason?.trim() || null,
        reviewedByUserId: this.currentUserId(admin),
        reviewedAt: new Date(),
      },
      include: this.offerInclude(),
    });

    return {
      success: true,
      message: 'Partner offer rejected successfully',
      data: this.formatOffer(offer),
    };
  }

  async getQrCodeFile(
    user: CurrentUserPayload,
    offerId: string,
    format: 'png' | 'jpg' | 'jpeg' = 'png',
  ) {
    if (!['png', 'jpg', 'jpeg'].includes(format)) {
      throw new BadRequestException('QR code format must be png, jpg, or jpeg');
    }

    const offer = await this.getDownloadableOffer(user, offerId);
    const qrPayload = this.qrPayload(offer.id);
    const pngBuffer = await QRCode.toBuffer(qrPayload, {
      type: 'png',
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 1024,
      color: {
        dark: '#062f33',
        light: '#ffffff',
      },
    });
    const normalizedFormat = format === 'jpeg' ? 'jpeg' : format;
    const buffer =
      normalizedFormat === 'png'
        ? pngBuffer
        : await sharp(pngBuffer).jpeg({ quality: 95 }).toBuffer();

    return {
      filename: `${this.slug(offer.title)}-qr-code.${format}`,
      contentType: normalizedFormat === 'png' ? 'image/png' : 'image/jpeg',
      buffer,
    };
  }

  async acceptScannedOffer(user: CurrentUserPayload, offerId: string) {
    const offer = await this.prisma.partnerOffer.findFirst({
      where: {
        id: offerId,
        ...this.publicOfferWhere(),
      },
      include: this.offerInclude(),
    });

    if (!offer) {
      throw new NotFoundException('Partner offer not found');
    }

    const userId = this.currentUserId(user);
    const redemption = await this.prisma.partnerOfferRedemption.create({
      data: { offerId: offer.id, userId },
    });

    return {
      success: true,
      message: 'Partner offer accepted successfully',
      data: {
        redemptionId: redemption.id,
        offer: this.formatOffer(offer),
      },
    };
  }

  async getPdfKitFile(user: CurrentUserPayload, offerId: string) {
    const offer = await this.getDownloadableOffer(user, offerId);
    const qrBuffer = await QRCode.toBuffer(this.qrPayload(offer.id), {
      type: 'png',
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 700,
      color: {
        dark: '#062f33',
        light: '#ffffff',
      },
    });

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc
        .fontSize(22)
        .fillColor('#062f33')
        .text('Offer Published!', { align: 'center' });
      doc.moveDown(0.4);
      doc
        .fontSize(11)
        .fillColor('#647487')
        .text(
          'Display this QR code at your store counter so families can scan and redeem.',
          { align: 'center' },
        );

      doc.moveDown(1.5);
      doc.roundedRect(72, doc.y, 451, 82, 8).strokeColor('#d8e5e8').stroke();
      doc.moveDown(0.7);
      doc
        .fontSize(14)
        .fillColor('#172436')
        .text(offer.title, 92, doc.y + 8);
      doc
        .fontSize(10)
        .fillColor('#087443')
        .text('Active', 92, doc.y + 4);

      const qrTop = 220;
      doc.image(qrBuffer, 170, qrTop, { width: 255, height: 255 });
      doc
        .fontSize(12)
        .fillColor('#062f33')
        .text(this.qrShortCode(offer.id), 0, qrTop + 266, {
          align: 'center',
        });
      doc
        .fontSize(10)
        .fillColor('#647487')
        .text(
          'Families scan this code at your store to unlock the offer in the Alurei app.',
          90,
          qrTop + 288,
          { align: 'center', width: 415 },
        );

      doc.moveDown(4);
      doc.fontSize(13).fillColor('#172436').text('Terms & Conditions', 72, 580);
      doc
        .fontSize(10)
        .fillColor('#647487')
        .text(
          offer.terms || 'Valid for approved Alurei families only.',
          72,
          604,
          {
            width: 450,
          },
        );

      doc.end();
    });

    return {
      filename: `${this.slug(offer.title)}-printable-kit.pdf`,
      contentType: 'application/pdf',
      buffer,
    };
  }

  private async getOffers(
    query: PartnerOfferQueryDto & {
      partnerUserId?: string;
      publicOnly?: boolean;
    },
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;
    const baseWhere = {
      ...(query.partnerUserId && { partnerUserId: query.partnerUserId }),
      ...this.filterWhere(query),
    } satisfies Prisma.PartnerOfferWhereInput;
    const statusWhere = query.publicOnly
      ? this.publicStatusWhere(query.status)
      : this.statusWhere(query.status);
    const where = this.andWhere(baseWhere, statusWhere);

    const [
      offers,
      total,
      allCount,
      activeCount,
      scheduledCount,
      pendingApprovalCount,
      expiredCount,
      rejectedCount,
      draftCount,
      inactiveCount,
    ] = await Promise.all([
      this.prisma.partnerOffer.findMany({
        where,
        include: this.offerInclude(),
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.partnerOffer.count({ where }),
      this.prisma.partnerOffer.count({
        where: this.andWhere(
          baseWhere,
          query.publicOnly ? this.publicAllWhere() : {},
        ),
      }),
      this.prisma.partnerOffer.count({
        where: this.andWhere(
          baseWhere,
          query.publicOnly
            ? this.publicStatusWhere('ACTIVE')
            : this.statusWhere('ACTIVE'),
        ),
      }),
      this.prisma.partnerOffer.count({
        where: this.andWhere(
          baseWhere,
          query.publicOnly
            ? this.publicStatusWhere('SCHEDULED')
            : this.statusWhere('SCHEDULED'),
        ),
      }),
      this.prisma.partnerOffer.count({
        where: this.andWhere(
          baseWhere,
          query.publicOnly
            ? this.publicStatusWhere('PENDING_APPROVAL')
            : this.statusWhere('PENDING_APPROVAL'),
        ),
      }),
      this.prisma.partnerOffer.count({
        where: this.andWhere(
          baseWhere,
          query.publicOnly
            ? this.publicStatusWhere('EXPIRED')
            : this.statusWhere('EXPIRED'),
        ),
      }),
      this.prisma.partnerOffer.count({
        where: this.andWhere(
          baseWhere,
          query.publicOnly
            ? this.publicStatusWhere('REJECTED')
            : this.statusWhere('REJECTED'),
        ),
      }),
      this.prisma.partnerOffer.count({
        where: this.andWhere(
          baseWhere,
          query.publicOnly
            ? this.publicStatusWhere('DRAFT')
            : this.statusWhere('DRAFT'),
        ),
      }),
      this.prisma.partnerOffer.count({
        where: this.andWhere(
          baseWhere,
          query.publicOnly
            ? this.publicStatusWhere('INACTIVE')
            : this.statusWhere('INACTIVE'),
        ),
      }),
    ]);

    return {
      success: true,
      message: 'Partner offers fetched successfully',
      data: offers.map((offer) => this.formatOffer(offer)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        filters: {
          status: query.status ?? 'ALL',
          search: query.search ?? null,
          offerType: query.offerType ?? null,
          redemptionFlow: query.redemptionFlow ?? null,
          category: query.category ?? null,
          startDateFrom: query.startDateFrom ?? null,
          endDateTo: query.endDateTo ?? null,
        },
        statusCounts: {
          ALL: allCount,
          ACTIVE: activeCount,
          SCHEDULED: scheduledCount,
          PENDING_APPROVAL: pendingApprovalCount,
          EXPIRED: expiredCount,
          REJECTED: rejectedCount,
          DRAFT: draftCount,
          INACTIVE: inactiveCount,
        },
      },
    };
  }

  private filterWhere(query: PartnerOfferQueryDto) {
    const search = query.search?.trim();

    return {
      ...(query.offerType && { offerType: query.offerType }),
      ...(query.redemptionFlow && { redemptionFlow: query.redemptionFlow }),
      ...(query.category && { category: query.category }),
      ...(search && {
        OR: [
          {
            title: {
              contains: search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          {
            productName: {
              contains: search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          {
            description: {
              contains: search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          {
            benefitTitle: {
              contains: search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          {
            benefitDescription: {
              contains: search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        ],
      }),
      ...((query.startDateFrom || query.endDateTo) && {
        AND: [
          ...(query.startDateFrom
            ? [
                {
                  OR: [
                    { endDate: null },
                    { endDate: { gte: new Date(query.startDateFrom) } },
                  ],
                },
              ]
            : []),
          ...(query.endDateTo
            ? [
                {
                  OR: [
                    { startDate: null },
                    { startDate: { lte: new Date(query.endDateTo) } },
                  ],
                },
              ]
            : []),
        ],
      }),
    } satisfies Prisma.PartnerOfferWhereInput;
  }

  private statusWhere(status?: string) {
    if (!status || status === 'ALL') return {};
    const now = new Date();

    if (status === 'SCHEDULED') {
      return {
        status: PartnerOfferStatus.ACTIVE,
        startDate: { gt: now },
      } satisfies Prisma.PartnerOfferWhereInput;
    }

    if (status === 'EXPIRED') {
      return {
        OR: [
          { status: PartnerOfferStatus.EXPIRED },
          { status: PartnerOfferStatus.ACTIVE, endDate: { lt: now } },
        ],
      } satisfies Prisma.PartnerOfferWhereInput;
    }

    if (status === 'ACTIVE') {
      return {
        status: PartnerOfferStatus.ACTIVE,
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: now } }] },
          { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        ],
      } satisfies Prisma.PartnerOfferWhereInput;
    }

    return { status: status as PartnerOfferStatus };
  }

  private publicStatusWhere(status?: string) {
    if (
      status === PartnerOfferStatus.PENDING_APPROVAL ||
      status === PartnerOfferStatus.REJECTED ||
      status === PartnerOfferStatus.DRAFT ||
      status === PartnerOfferStatus.INACTIVE
    ) {
      return {
        id: '__no_public_offer_for_private_status__',
      } satisfies Prisma.PartnerOfferWhereInput;
    }

    if (!status || status === 'ALL') {
      return this.publicAllWhere();
    }

    if (status === 'ACTIVE' || status === 'SCHEDULED' || status === 'EXPIRED') {
      return this.statusWhere(status);
    }

    return this.publicAllWhere();
  }

  private publicAllWhere() {
    return {
      OR: [
        this.statusWhere('ACTIVE'),
        this.statusWhere('SCHEDULED'),
        this.statusWhere('EXPIRED'),
      ],
    } satisfies Prisma.PartnerOfferWhereInput;
  }

  private publicOfferWhere() {
    const now = new Date();

    return {
      status: PartnerOfferStatus.ACTIVE,
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
      ],
    } satisfies Prisma.PartnerOfferWhereInput;
  }

  private andWhere(
    ...parts: Prisma.PartnerOfferWhereInput[]
  ): Prisma.PartnerOfferWhereInput {
    const filtered = parts.filter((part) => Object.keys(part).length > 0);
    if (filtered.length === 0) return {};
    if (filtered.length === 1) return filtered[0];
    return { AND: filtered };
  }

  private async validateOfferPayload(
    partnerUserId: string,
    dto: Partial<CreatePartnerOfferDto>,
  ) {
    if (dto.startDate && dto.endDate) {
      const startDate = new Date(dto.startDate);
      const endDate = new Date(dto.endDate);
      if (startDate > endDate) {
        throw new BadRequestException('startDate must be before endDate');
      }
    }

    if (
      dto.deductionPercentage !== undefined &&
      (dto.deductionPercentage < 0 || dto.deductionPercentage > 100)
    ) {
      throw new BadRequestException(
        'deductionPercentage must be between 0 and 100',
      );
    }

    if (dto.offerType === PartnerOfferType.PRODUCT_BASED) {
      if (!dto.productId && !dto.productName && !dto.category) {
        throw new BadRequestException(
          'productId, productName, or category is required for product based offers',
        );
      }

      if (dto.productId) {
        const product = await this.prisma.partnerProduct.findFirst({
          where: { id: dto.productId, partnerUserId },
          select: { id: true },
        });

        if (!product) {
          throw new NotFoundException('Selected product not found');
        }
      }
    }
  }

  private async validateLocations(
    partnerUserId: string,
    locations?: PartnerOfferLocationDto[],
  ) {
    const storeIds = [
      ...new Set((locations ?? []).map((item) => item.storeId).filter(Boolean)),
    ] as string[];

    if (storeIds.length === 0) return;

    const stores = await this.prisma.store.findMany({
      where: { id: { in: storeIds }, userId: partnerUserId },
      select: { id: true },
    });

    if (stores.length !== storeIds.length) {
      throw new NotFoundException(
        'One or more selected outlet locations were not found',
      );
    }
  }

  private offerData(dto: Partial<CreatePartnerOfferDto>) {
    return {
      ...(dto.redemptionFlow !== undefined && {
        redemptionFlow: dto.redemptionFlow,
      }),
      ...(dto.offerType !== undefined && { offerType: dto.offerType }),
      ...(dto.title !== undefined && { title: dto.title.trim() }),
      ...(dto.description !== undefined && {
        description: dto.description?.trim() || null,
      }),
      ...(dto.heroImageUrl !== undefined && {
        heroImageUrl: dto.heroImageUrl?.trim() || null,
      }),
      ...(dto.useDefaultHeroImage !== undefined && {
        useDefaultHeroImage: dto.useDefaultHeroImage,
      }),
      ...(dto.productId !== undefined && {
        productId: dto.productId?.trim() || null,
      }),
      ...(dto.productName !== undefined && {
        productName: dto.productName?.trim() || null,
      }),
      ...(dto.category !== undefined && { category: dto.category }),
      ...(dto.minimumSpend !== undefined && {
        minimumSpend: new Prisma.Decimal(dto.minimumSpend),
      }),
      ...(dto.deductionPercentage !== undefined && {
        deductionPercentage: new Prisma.Decimal(dto.deductionPercentage),
      }),
      ...(dto.requiredAlurei !== undefined && {
        requiredAlurei: dto.requiredAlurei,
      }),
      ...(dto.eligiblePlans !== undefined && {
        eligiblePlans: dto.eligiblePlans,
      }),
      ...(dto.benefitTitle !== undefined && {
        benefitTitle: dto.benefitTitle?.trim() || null,
      }),
      ...(dto.benefitDescription !== undefined && {
        benefitDescription: dto.benefitDescription?.trim() || null,
      }),
      ...(dto.terms !== undefined && { terms: dto.terms?.trim() || null }),
      ...(dto.availableAllOutlets !== undefined && {
        availableAllOutlets: dto.availableAllOutlets,
      }),
      ...(dto.recommendExternal !== undefined && {
        recommendExternal: dto.recommendExternal,
      }),
      ...(dto.startDate !== undefined && {
        startDate: dto.startDate ? new Date(dto.startDate) : null,
      }),
      ...(dto.endDate !== undefined && {
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      }),
    } satisfies Partial<Prisma.PartnerOfferUncheckedCreateInput>;
  }

  private locationData(locations?: PartnerOfferLocationDto[]) {
    return (locations ?? []).map((location) => ({
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
      partnerProduct: true,
      partnerUser: {
        select: {
          id: true,
          fullName: true,
          email: true,
          profilePictureUrl: true,
        },
      },
    } satisfies Prisma.PartnerOfferInclude;
  }

  private formatOffer(
    offer: Prisma.PartnerOfferGetPayload<{
      include: ReturnType<PartnerOfferService['offerInclude']>;
    }>,
  ) {
    return {
      id: offer.id,
      partnerUserId: offer.partnerUserId,
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
      displayStatus: this.displayStatus(offer),
      rejectionReason: offer.rejectionReason,
      reviewedByUserId: offer.reviewedByUserId,
      reviewedAt: offer.reviewedAt,
      publishedAt: offer.publishedAt,
      qrPayload: this.isPublishedNow(offer) ? this.qrPayload(offer.id) : null,
      qrShortCode: this.isPublishedNow(offer)
        ? this.qrShortCode(offer.id)
        : null,
      qrDownloads: this.isPublishedNow(offer)
        ? this.qrDownloadUrls(offer.id)
        : null,
      qrCodeDownloadUrl: this.isPublishedNow(offer)
        ? this.qrDownloadUrls(offer.id).png
        : null,
      pdfKitDownloadUrl: this.isPublishedNow(offer)
        ? this.qrDownloadUrls(offer.id).pdf
        : null,
      locations: offer.locations,
      product: offer.partnerProduct
        ? {
            ...offer.partnerProduct,
            price: Number(offer.partnerProduct.price),
          }
        : null,
      partner: offer.partnerUser,
      createdAt: offer.createdAt,
      updatedAt: offer.updatedAt,
    };
  }

  private displayStatus(offer: {
    status: PartnerOfferStatus;
    startDate: Date | null;
    endDate: Date | null;
  }) {
    const now = new Date();

    if (
      offer.status === PartnerOfferStatus.ACTIVE &&
      offer.startDate &&
      offer.startDate > now
    ) {
      return 'SCHEDULED';
    }

    if (
      offer.status === PartnerOfferStatus.ACTIVE &&
      offer.endDate &&
      offer.endDate < now
    ) {
      return 'EXPIRED';
    }

    return offer.status;
  }

  private async notifyPartnerOfferApproved(
    offer: Prisma.PartnerOfferGetPayload<{
      include: ReturnType<PartnerOfferService['offerInclude']>;
    }>,
  ) {
    await this.notificationService.createNotification({
      userId: offer.partnerUserId,
      type: NotificationType.PARTNER_OFFER,
      title: 'Offer Published!',
      message:
        'Your in-store offer is live. Display the QR code at your store counter.',
      iconType: 'GIFT',
      actionText: 'View QR Code',
      actionUrl: `/partner-offers-ui?offerId=${offer.id}&published=1`,
      metadata: {
        event: 'PARTNER_OFFER_APPROVED',
        offerId: offer.id,
        status: offer.status,
        displayStatus: this.displayStatus(offer),
        title: offer.title,
        redemptionFlow: offer.redemptionFlow,
        qrPayload: this.qrPayload(offer.id),
        qrDownloads: this.qrDownloadUrls(offer.id),
        qrCodeDownloadUrl: this.qrDownloadUrls(offer.id).png,
        pdfKitDownloadUrl: this.qrDownloadUrls(offer.id).pdf,
      },
    });
  }

  private async getDownloadableOffer(
    user: CurrentUserPayload,
    offerId: string,
  ) {
    const userId = this.currentUserId(user);
    const offer = await this.prisma.partnerOffer.findFirst({
      where: {
        id: offerId,
        ...(user.role === UserRole.PARTNER && { partnerUserId: userId }),
      },
      include: this.offerInclude(),
    });

    if (!offer) {
      throw new NotFoundException('Partner offer not found');
    }

    if (!this.isPublishedNow(offer)) {
      throw new BadRequestException(
        'QR code and PDF kit are available only after offer approval',
      );
    }

    return offer;
  }

  private isPublishedNow(offer: {
    status: PartnerOfferStatus;
    startDate: Date | null;
    endDate: Date | null;
  }) {
    const now = new Date();
    return (
      offer.status === PartnerOfferStatus.ACTIVE &&
      (!offer.startDate || offer.startDate <= now) &&
      (!offer.endDate || offer.endDate >= now)
    );
  }

  private qrPayload(offerId: string) {
    return JSON.stringify({
      type: 'ALUREI_PARTNER_OFFER',
      offerId,
    });
  }

  private qrDownloadUrls(offerId: string) {
    return {
      png: `/api/v1/partner/offers/${offerId}/qr-code`,
      jpg: `/api/v1/partner/offers/${offerId}/qr-code/jpg`,
      jpeg: `/api/v1/partner/offers/${offerId}/qr-code/jpeg`,
      pdf: `/api/v1/partner/offers/${offerId}/pdf-kit`,
    };
  }

  private qrShortCode(offerId: string) {
    return `ALUREI-QR-${offerId.slice(0, 6).toUpperCase()}`;
  }

  private slug(value: string) {
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    return slug || 'partner-offer';
  }

  private async assertOfferExists(offerId: string) {
    const offer = await this.prisma.partnerOffer.findUnique({
      where: { id: offerId },
      select: { id: true, status: true },
    });

    if (!offer) {
      throw new NotFoundException('Partner offer not found');
    }

    return offer;
  }

  private ensurePartner(user: CurrentUserPayload) {
    if (user.role !== UserRole.PARTNER) {
      throw new ForbiddenException('Only partner users can manage offers');
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
