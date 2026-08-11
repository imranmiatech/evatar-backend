import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import type { CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreatePartnerProductDto,
  UpdatePartnerProductDto,
} from './dto/create-partner-product.dto';

@Injectable()
export class PartnerProductService {
  constructor(private readonly prisma: PrismaService) {}

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

  private ensurePartner(user: CurrentUserPayload) {
    if (user.role !== UserRole.PARTNER) {
      throw new BadRequestException('Only partner users can manage products');
    }
  }

  private currentUserId(user: CurrentUserPayload) {
    return user.userId ?? user.id;
  }

  private formatProduct(product: any) {
    return {
      id: product.id,
      partnerUserId: product.partnerUserId,
      productName: product.productName,
      category: product.category,
      sku: product.sku,
      tags: product.tags,
      price: Number(product.price),
      unit: product.unit,
      availability: product.availability,
      status: product.status,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  private handleProductWriteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new BadRequestException('SKU already exists for this partner');
    }

    throw error;
  }
}
