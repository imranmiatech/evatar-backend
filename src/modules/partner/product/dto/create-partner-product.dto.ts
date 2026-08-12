import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  PartnerProductAvailability,
  PartnerProductCategory,
  PartnerProductStatus,
  PartnerProductUnit,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

const normalizeEnum = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  return value
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
};

const normalizeTags = ({ value }: { value: unknown }) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      // Fall back to comma-separated parsing.
    }

    return trimmed
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

export class CreatePartnerProductDto {
  @ApiProperty({
    example: 'Baby Organic Yogurt',
    description: 'Product name shown in partner product catalog.',
  })
  @IsString()
  @IsNotEmpty()
  productName!: string;

  @ApiProperty({
    enum: PartnerProductCategory,
    example: PartnerProductCategory.BABY,
    description:
      'Product category. Display labels like "Baby" or enum values like BABY are accepted.',
  })
  @Transform(normalizeEnum)
  @IsEnum(PartnerProductCategory)
  category!: PartnerProductCategory;

  @ApiPropertyOptional({
    example: 'SKU-001',
    description: 'SKU/Product ID. Must be unique per partner when provided.',
  })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['yogurt meal', 'apple juice'],
    description:
      'Product tags. Accepts JSON array, string array, or comma-separated string.',
  })
  @Transform(normalizeTags)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiProperty({
    example: 12.5,
    description: 'Product price.',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @ApiProperty({
    enum: PartnerProductUnit,
    example: PartnerProductUnit.LITER,
    description:
      'Product unit. Display labels like "Liter" or enum values like LITER are accepted.',
  })
  @Transform(normalizeEnum)
  @IsEnum(PartnerProductUnit)
  unit!: PartnerProductUnit;

  @ApiPropertyOptional({
    enum: PartnerProductAvailability,
    example: PartnerProductAvailability.IN_STOCK,
    description:
      'Availability. Display labels like "In Stock" or enum values like IN_STOCK are accepted.',
  })
  @Transform(normalizeEnum)
  @IsEnum(PartnerProductAvailability)
  @IsOptional()
  availability?: PartnerProductAvailability;

  @ApiPropertyOptional({
    enum: PartnerProductStatus,
    example: PartnerProductStatus.PUBLISHED,
    description: 'Use DRAFT for Save draft and PUBLISHED for Publish Product.',
  })
  @Transform(normalizeEnum)
  @IsEnum(PartnerProductStatus)
  @IsOptional()
  status?: PartnerProductStatus;
}

export class UpdatePartnerProductDto extends PartialType(
  CreatePartnerProductDto,
) {}

export class PartnerProductQueryDto {
  @ApiPropertyOptional({
    example: 'Baby Organic Yogurt',
    description: 'Search by product name, SKU, or tag.',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: ['ALL', ...Object.values(PartnerProductCategory)],
    example: 'PRODUCE',
  })
  @IsOptional()
  @Transform(normalizeEnum)
  @IsIn(['ALL', ...Object.values(PartnerProductCategory)])
  category?: 'ALL' | PartnerProductCategory;

  @ApiPropertyOptional({
    enum: ['ALL', ...Object.values(PartnerProductAvailability)],
    example: 'IN_STOCK',
  })
  @IsOptional()
  @Transform(normalizeEnum)
  @IsIn(['ALL', ...Object.values(PartnerProductAvailability)])
  availability?: 'ALL' | PartnerProductAvailability;

  @ApiPropertyOptional({
    enum: ['ALL', ...Object.values(PartnerProductStatus)],
    example: 'PUBLISHED',
  })
  @IsOptional()
  @Transform(normalizeEnum)
  @IsIn(['ALL', ...Object.values(PartnerProductStatus)])
  status?: 'ALL' | PartnerProductStatus;

  @ApiPropertyOptional({
    description: 'Filter products that have at least one linked offer.',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  hasOffer?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
