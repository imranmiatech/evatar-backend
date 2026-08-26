import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import type { CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreatePartnerProductDto,
  PartnerProductQueryDto,
  UpdatePartnerProductDto,
} from './dto/create-partner-product.dto';
import {
  CreateDefaultPartnerProductDto,
  DefaultPartnerProductQueryDto,
  ImportDefaultPartnerProductDto,
  UpdateDefaultPartnerProductDto,
} from './dto/default-partner-product.dto';

@Injectable()
export class PartnerProductService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaultProducts();
  }

  async getProducts(user: CurrentUserPayload, query: PartnerProductQueryDto) {
    this.ensurePartner(user);
    const partnerUserId = this.currentUserId(user);
    const page = query.page ?? 1;
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const skip = (page - 1) * limit;
    const where = this.productWhere(partnerUserId, query);
    const countBaseWhere = this.productWhere(partnerUserId, {
      ...query,
      category: 'ALL',
      availability: 'ALL',
      status: 'ALL',
      hasOffer: undefined,
    });

    const [
      products,
      total,
      allCount,
      publishedCount,
      draftCount,
      inStockCount,
      outOfStockCount,
      limitedCount,
      withOfferCount,
      categoryCounts,
    ] = await Promise.all([
      this.prisma.partnerProduct.findMany({
        where,
        include: this.productInclude(),
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.partnerProduct.count({ where }),
      this.prisma.partnerProduct.count({ where: countBaseWhere }),
      this.prisma.partnerProduct.count({
        where: { ...countBaseWhere, status: 'PUBLISHED' },
      }),
      this.prisma.partnerProduct.count({
        where: { ...countBaseWhere, status: 'DRAFT' },
      }),
      this.prisma.partnerProduct.count({
        where: { ...countBaseWhere, availability: 'IN_STOCK' },
      }),
      this.prisma.partnerProduct.count({
        where: { ...countBaseWhere, availability: 'OUT_OF_STOCK' },
      }),
      this.prisma.partnerProduct.count({
        where: { ...countBaseWhere, availability: 'LIMITED' },
      }),
      this.prisma.partnerProduct.count({
        where: { ...countBaseWhere, offers: { some: {} } },
      }),
      this.prisma.partnerProduct.groupBy({
        by: ['category'],
        where: countBaseWhere,
        _count: { category: true },
      }),
    ]);

    return {
      success: true,
      message: 'Partner products fetched successfully',
      data: products.map((product) => this.formatProduct(product)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        filters: {
          search: query.search ?? null,
          category: query.category ?? 'ALL',
          availability: query.availability ?? 'ALL',
          status: query.status ?? 'ALL',
          hasOffer: query.hasOffer ?? null,
          minPrice: query.minPrice ?? null,
          maxPrice: query.maxPrice ?? null,
        },
        counts: {
          ALL: allCount,
          ACTIVE: publishedCount,
          DRAFT: draftCount,
          IN_STOCK: inStockCount,
          OUT_OF_STOCK: outOfStockCount,
          LIMITED: limitedCount,
          WITH_OFFER: withOfferCount,
          CATEGORY: Object.fromEntries(
            categoryCounts.map((item) => [item.category, item._count.category]),
          ),
        },
      },
    };
  }

  async getProduct(user: CurrentUserPayload, productId: string) {
    this.ensurePartner(user);
    const partnerUserId = this.currentUserId(user);

    const product = await this.prisma.partnerProduct.findFirst({
      where: { id: productId, partnerUserId },
      include: this.productInclude(),
    });

    if (!product) {
      throw new NotFoundException('Partner product not found');
    }

    return {
      success: true,
      message: 'Partner product fetched successfully',
      data: this.formatProduct(product),
    };
  }

  async createProduct(user: CurrentUserPayload, dto: CreatePartnerProductDto) {
    this.ensurePartner(user);
    const partnerUserId = this.currentUserId(user);

    try {
      const product = await this.prisma.partnerProduct.create({
        data: {
          partnerUserId,
          productName: dto.productName.trim(),
          category: dto.category,
          sku: dto.sku?.trim() || null,
          tags: dto.tags ?? [],
          price: new Prisma.Decimal(dto.price),
          unit: dto.unit,
          availability: dto.availability ?? 'IN_STOCK',
          status: dto.status ?? 'DRAFT',
        },
      });

      return {
        success: true,
        message:
          product.status === 'PUBLISHED'
            ? 'Partner product published successfully'
            : 'Partner product draft saved successfully',
        data: this.formatProduct(product),
      };
    } catch (error) {
      this.handleProductWriteError(error);
    }
  }

  async updateProduct(
    user: CurrentUserPayload,
    productId: string,
    dto: UpdatePartnerProductDto,
  ) {
    this.ensurePartner(user);
    const partnerUserId = this.currentUserId(user);

    const existing = await this.prisma.partnerProduct.findFirst({
      where: { id: productId, partnerUserId },
    });

    if (!existing) {
      throw new NotFoundException('Partner product not found');
    }

    try {
      const product = await this.prisma.partnerProduct.update({
        where: { id: productId },
        data: {
          ...(dto.productName !== undefined && {
            productName: dto.productName.trim(),
          }),
          ...(dto.category !== undefined && { category: dto.category }),
          ...(dto.sku !== undefined && { sku: dto.sku?.trim() || null }),
          ...(dto.tags !== undefined && { tags: dto.tags }),
          ...(dto.price !== undefined && {
            price: new Prisma.Decimal(dto.price),
          }),
          ...(dto.unit !== undefined && { unit: dto.unit }),
          ...(dto.availability !== undefined && {
            availability: dto.availability,
          }),
          ...(dto.status !== undefined && { status: dto.status }),
        },
      });

      return {
        success: true,
        message: 'Partner product updated successfully',
        data: this.formatProduct(product),
      };
    } catch (error) {
      this.handleProductWriteError(error);
    }
  }

  async deleteProduct(user: CurrentUserPayload, productId: string) {
    this.ensurePartner(user);
    const partnerUserId = this.currentUserId(user);

    const existing = await this.prisma.partnerProduct.findFirst({
      where: { id: productId, partnerUserId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Partner product not found');
    }

    await this.prisma.partnerProduct.delete({ where: { id: productId } });

    return {
      success: true,
      message: 'Partner product deleted successfully',
      data: { id: productId, deleted: true },
    };
  }

  async getDefaultProductsForPartner(
    user: CurrentUserPayload,
    query: DefaultPartnerProductQueryDto,
  ) {
    this.ensurePartner(user);
    const partnerUserId = this.currentUserId(user);
    const page = query.page ?? 1;
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const skip = (page - 1) * limit;
    const where = this.defaultProductWhere(query, false);

    const [items, total, importedRows] = await Promise.all([
      this.prisma.defaultPartnerProduct.findMany({
        where,
        orderBy: [{ category: 'asc' }, { productName: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.defaultPartnerProduct.count({ where }),
      this.prisma.partnerProduct.findMany({
        where: {
          partnerUserId,
          defaultProductId: { not: null },
        },
        select: {
          id: true,
          defaultProductId: true,
        },
      }),
    ]);

    const importedMap = new Map(
      importedRows
        .filter((item) => item.defaultProductId)
        .map((item) => [item.defaultProductId as string, item.id]),
    );

    return {
      success: true,
      message: 'Default partner products fetched successfully',
      data: items.map((item) =>
        this.formatDefaultProduct(item, {
          addedToMyProducts: importedMap.has(item.id),
          partnerProductId: importedMap.get(item.id) ?? null,
        }),
      ),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        filters: {
          search: query.search ?? null,
          category: query.category ?? 'ALL',
          availability: query.availability ?? 'ALL',
        },
      },
    };
  }

  async importDefaultProductToPartner(
    user: CurrentUserPayload,
    defaultProductId: string,
    dto: ImportDefaultPartnerProductDto,
  ) {
    this.ensurePartner(user);
    const partnerUserId = this.currentUserId(user);

    const defaultProduct = await this.prisma.defaultPartnerProduct.findFirst({
      where: { id: defaultProductId, isActive: true },
    });

    if (!defaultProduct) {
      throw new NotFoundException('Default product not found');
    }

    const existing = await this.prisma.partnerProduct.findFirst({
      where: {
        partnerUserId,
        defaultProductId,
      },
    });

    if (existing) {
      return {
        success: true,
        message: 'Default product already added to your products',
        data: this.formatProduct(existing),
      };
    }

    try {
      const created = await this.prisma.partnerProduct.create({
        data: {
          partnerUserId,
          defaultProductId: defaultProduct.id,
          productName: defaultProduct.productName,
          category: defaultProduct.category,
          sku: defaultProduct.sku,
          tags: defaultProduct.tags,
          price: defaultProduct.price,
          unit: defaultProduct.unit,
          availability: defaultProduct.availability,
          status: dto.status ?? 'DRAFT',
        },
      });

      return {
        success: true,
        message: 'Default product added to partner products successfully',
        data: this.formatProduct(created),
      };
    } catch (error) {
      this.handleProductWriteError(error);
    }
  }

  async getAdminDefaultProducts(query: DefaultPartnerProductQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const skip = (page - 1) * limit;
    const where = this.defaultProductWhere(query, true);

    const [items, total] = await Promise.all([
      this.prisma.defaultPartnerProduct.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { category: 'asc' }, { productName: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.defaultPartnerProduct.count({ where }),
    ]);

    return {
      success: true,
      message: 'Admin default products fetched successfully',
      data: items.map((item) => this.formatDefaultProduct(item)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createAdminDefaultProduct(
    user: CurrentUserPayload,
    dto: CreateDefaultPartnerProductDto,
  ) {
    this.ensureAdmin(user);
    try {
      const created = await this.prisma.defaultPartnerProduct.create({
        data: {
          createdById: this.currentUserId(user),
          productName: dto.productName.trim(),
          category: dto.category,
          sku: dto.sku?.trim() || null,
          tags: dto.tags ?? [],
          price: new Prisma.Decimal(dto.price),
          unit: dto.unit,
          availability: dto.availability ?? 'IN_STOCK',
          isActive: dto.isActive ?? true,
        },
      });

      return {
        success: true,
        message: 'Default product created successfully',
        data: this.formatDefaultProduct(created),
      };
    } catch (error) {
      this.handleDefaultProductWriteError(error);
    }
  }

  async updateAdminDefaultProduct(
    user: CurrentUserPayload,
    defaultProductId: string,
    dto: UpdateDefaultPartnerProductDto,
  ) {
    this.ensureAdmin(user);
    const existing = await this.prisma.defaultPartnerProduct.findUnique({
      where: { id: defaultProductId },
    });

    if (!existing) {
      throw new NotFoundException('Default product not found');
    }

    try {
      const updated = await this.prisma.defaultPartnerProduct.update({
        where: { id: defaultProductId },
        data: {
          ...(dto.productName !== undefined && {
            productName: dto.productName.trim(),
          }),
          ...(dto.category !== undefined && { category: dto.category }),
          ...(dto.sku !== undefined && { sku: dto.sku?.trim() || null }),
          ...(dto.tags !== undefined && { tags: dto.tags }),
          ...(dto.price !== undefined && {
            price: new Prisma.Decimal(dto.price),
          }),
          ...(dto.unit !== undefined && { unit: dto.unit }),
          ...(dto.availability !== undefined && {
            availability: dto.availability,
          }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });

      return {
        success: true,
        message: 'Default product updated successfully',
        data: this.formatDefaultProduct(updated),
      };
    } catch (error) {
      this.handleDefaultProductWriteError(error);
    }
  }

  async deleteAdminDefaultProduct(
    user: CurrentUserPayload,
    defaultProductId: string,
  ) {
    this.ensureAdmin(user);
    const existing = await this.prisma.defaultPartnerProduct.findUnique({
      where: { id: defaultProductId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Default product not found');
    }

    await this.prisma.defaultPartnerProduct.update({
      where: { id: defaultProductId },
      data: { isActive: false },
    });

    return {
      success: true,
      message: 'Default product archived successfully',
      data: { id: defaultProductId, archived: true },
    };
  }

  private ensurePartner(user: CurrentUserPayload) {
    if (user.role !== UserRole.PARTNER) {
      throw new BadRequestException('Only partner users can manage products');
    }
  }

  private ensureAdmin(user: CurrentUserPayload) {
    if (user.role !== UserRole.ADMIN) {
      throw new BadRequestException(
        'Only admin users can manage default partner products',
      );
    }
  }

  private currentUserId(user: CurrentUserPayload) {
    return user.userId ?? user.id;
  }

  private productWhere(
    partnerUserId: string,
    query: Partial<PartnerProductQueryDto>,
  ) {
    const search = query.search?.trim();

    return {
      partnerUserId,
      ...(query.category &&
        query.category !== 'ALL' && { category: query.category }),
      ...(query.availability &&
        query.availability !== 'ALL' && { availability: query.availability }),
      ...(query.status && query.status !== 'ALL' && { status: query.status }),
      ...(query.hasOffer !== undefined && {
        offers: query.hasOffer ? { some: {} } : { none: {} },
      }),
      ...((query.minPrice !== undefined || query.maxPrice !== undefined) && {
        price: {
          ...(query.minPrice !== undefined && {
            gte: new Prisma.Decimal(query.minPrice),
          }),
          ...(query.maxPrice !== undefined && {
            lte: new Prisma.Decimal(query.maxPrice),
          }),
        },
      }),
      ...(search && {
        OR: [
          {
            productName: {
              contains: search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          {
            sku: {
              contains: search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          {
            tags: { has: search },
          },
        ],
      }),
    } satisfies Prisma.PartnerProductWhereInput;
  }

  private defaultProductWhere(
    query: Partial<DefaultPartnerProductQueryDto>,
    adminMode: boolean,
  ) {
    const search = query.search?.trim();

    return {
      ...((adminMode && query.includeInactive) || adminMode
        ? {}
        : { isActive: true }),
      ...(query.category &&
        query.category !== 'ALL' && { category: query.category }),
      ...(query.availability &&
        query.availability !== 'ALL' && { availability: query.availability }),
      ...(search && {
        OR: [
          {
            productName: {
              contains: search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          {
            sku: {
              contains: search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          {
            tags: { has: search },
          },
        ],
      }),
    } satisfies Prisma.DefaultPartnerProductWhereInput;
  }

  private productInclude() {
    return {
      offers: {
        orderBy: { updatedAt: 'desc' as const },
        take: 1,
        select: {
          id: true,
          title: true,
          status: true,
          deductionPercentage: true,
          requiredAlurei: true,
          startDate: true,
          endDate: true,
        },
      },
    } satisfies Prisma.PartnerProductInclude;
  }

  private formatProduct(product: any) {
    const latestOffer = product.offers?.[0] ?? null;
    return {
      id: product.id,
      partnerUserId: product.partnerUserId,
      defaultProductId: product.defaultProductId ?? null,
      isImportedFromDefault: Boolean(product.defaultProductId),
      productName: product.productName,
      category: product.category,
      categoryLabel: this.label(product.category),
      sku: product.sku,
      tags: product.tags,
      price: Number(product.price),
      priceLabel: `£${Number(product.price).toFixed(2)}`,
      unit: product.unit,
      availability: product.availability,
      availabilityLabel: this.availabilityLabel(product.availability),
      status: product.status,
      statusLabel: product.status === 'PUBLISHED' ? 'Active' : 'Draft',
      offer: latestOffer
        ? {
            id: latestOffer.id,
            title: latestOffer.title,
            status: latestOffer.status,
            deductionPercentage:
              latestOffer.deductionPercentage === null
                ? null
                : Number(latestOffer.deductionPercentage),
            label:
              latestOffer.deductionPercentage === null
                ? null
                : `${Number(latestOffer.deductionPercentage)}% Off`,
            requiredAlurei: latestOffer.requiredAlurei,
            startDate: latestOffer.startDate,
            endDate: latestOffer.endDate,
          }
        : null,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  private formatDefaultProduct(
    product: any,
    extra: { addedToMyProducts?: boolean; partnerProductId?: string | null } = {},
  ) {
    return {
      id: product.id,
      createdById: product.createdById ?? null,
      productName: product.productName,
      category: product.category,
      categoryLabel: this.label(product.category),
      sku: product.sku,
      tags: product.tags,
      price: Number(product.price),
      priceLabel: `£${Number(product.price).toFixed(2)}`,
      unit: product.unit,
      availability: product.availability,
      availabilityLabel: this.availabilityLabel(product.availability),
      isActive: product.isActive,
      addedToMyProducts: extra.addedToMyProducts ?? false,
      partnerProductId: extra.partnerProductId ?? null,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  private label(value: string) {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private availabilityLabel(value: string) {
    if (value === 'IN_STOCK') return 'In stock';
    if (value === 'OUT_OF_STOCK') return 'Out of Stock';
    return this.label(value);
  }

  private handleProductWriteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new BadRequestException(
        'SKU already exists for this partner or this default product was already added',
      );
    }

    throw error;
  }

  private handleDefaultProductWriteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new BadRequestException('Default product SKU already exists');
    }

    throw error;
  }

  private async seedDefaultProducts() {
    const defaults = [
      {
        productName: 'Farm Fresh Almond Milk',
        category: 'DAIRY',
        sku: 'DEFAULT-ALMOND-MILK-001',
        tags: ['almond milk', 'fresh'],
        price: 16.5,
        unit: 'LITER',
      },
      {
        productName: 'Sunrise Organic Yogurt',
        category: 'DAIRY',
        sku: 'DEFAULT-YOGURT-001',
        tags: ['organic', 'yogurt'],
        price: 11.25,
        unit: 'PACK',
      },
      {
        productName: 'Golden Valley Honey',
        category: 'PANTRY',
        sku: 'DEFAULT-HONEY-001',
        tags: ['honey', 'natural'],
        price: 18.75,
        unit: 'PACK',
      },
      {
        productName: 'Pure Spring Water',
        category: 'PANTRY',
        sku: 'DEFAULT-WATER-001',
        tags: ['water', 'drinks'],
        price: 6.5,
        unit: 'LITER',
      },
      {
        productName: 'Wildflower Herbal Tea',
        category: 'PANTRY',
        sku: 'DEFAULT-TEA-001',
        tags: ['tea', 'herbal'],
        price: 9.9,
        unit: 'PACK',
      },
      {
        productName: 'Almond Milk',
        category: 'DAIRY',
        sku: 'DEFAULT-ALMOND-MILK-002',
        tags: ['milk', 'almond'],
        price: 13.2,
        unit: 'LITER',
      },
      {
        productName: 'Soy Milk',
        category: 'DAIRY',
        sku: 'DEFAULT-SOY-MILK-001',
        tags: ['soy milk'],
        price: 12.6,
        unit: 'LITER',
      },
      {
        productName: 'Coconut Milk',
        category: 'DAIRY',
        sku: 'DEFAULT-COCONUT-MILK-001',
        tags: ['coconut milk'],
        price: 14.1,
        unit: 'LITER',
      },
      {
        productName: 'Oat Milk',
        category: 'DAIRY',
        sku: 'DEFAULT-OAT-MILK-001',
        tags: ['oat milk'],
        price: 14.35,
        unit: 'LITER',
      },
    ] as const;

    await Promise.all(
      defaults.map((item) =>
        this.prisma.defaultPartnerProduct.upsert({
          where: { sku: item.sku },
          update: {
            productName: item.productName,
            category: item.category,
            tags: [...item.tags],
            price: new Prisma.Decimal(item.price),
            unit: item.unit,
            availability: 'IN_STOCK',
            isActive: true,
          },
          create: {
            productName: item.productName,
            category: item.category,
            sku: item.sku,
            tags: [...item.tags],
            price: new Prisma.Decimal(item.price),
            unit: item.unit,
            availability: 'IN_STOCK',
            isActive: true,
          },
        }),
      ),
    );
  }
}
