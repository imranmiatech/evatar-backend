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
  IsEnum,
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
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
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
    description:
      'Use DRAFT for Save draft and PUBLISHED for Publish Product.',
  })
  @Transform(normalizeEnum)
  @IsEnum(PartnerProductStatus)
  @IsOptional()
  status?: PartnerProductStatus;
}

export class UpdatePartnerProductDto extends PartialType(CreatePartnerProductDto) {}
