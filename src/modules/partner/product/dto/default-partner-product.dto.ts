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

export class CreateDefaultPartnerProductDto {
  @ApiProperty({ example: 'Farm Fresh Almond Milk' })
  @IsString()
  @IsNotEmpty()
  productName!: string;

  @ApiProperty({
    enum: PartnerProductCategory,
    example: PartnerProductCategory.DAIRY,
  })
  @Transform(normalizeEnum)
  @IsEnum(PartnerProductCategory)
  category!: PartnerProductCategory;

  @ApiPropertyOptional({
    example: 'ALMOND-MILK-001',
    description: 'Optional admin SKU. Must be unique globally when provided.',
  })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['almond milk', 'organic'],
  })
  @Transform(normalizeTags)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiProperty({ example: 14.5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @ApiProperty({
    enum: PartnerProductUnit,
    example: PartnerProductUnit.LITER,
  })
  @Transform(normalizeEnum)
  @IsEnum(PartnerProductUnit)
  unit!: PartnerProductUnit;

  @ApiPropertyOptional({
    enum: PartnerProductAvailability,
    example: PartnerProductAvailability.IN_STOCK,
  })
  @Transform(normalizeEnum)
  @IsEnum(PartnerProductAvailability)
  @IsOptional()
  availability?: PartnerProductAvailability;

  @ApiPropertyOptional({
    example: true,
    description: 'Inactive default products stay hidden from partner import list.',
  })
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateDefaultPartnerProductDto extends PartialType(
  CreateDefaultPartnerProductDto,
) {}

export class DefaultPartnerProductQueryDto {
  @ApiPropertyOptional({ example: 'almond milk' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: ['ALL', ...Object.values(PartnerProductCategory)],
    example: 'DAIRY',
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
    example: true,
    description: 'Admin only. Include inactive products in listing.',
  })
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  @IsOptional()
  includeInactive?: boolean;

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

export class ImportDefaultPartnerProductDto {
  @ApiPropertyOptional({
    enum: PartnerProductStatus,
    example: PartnerProductStatus.PUBLISHED,
    description: 'Imported partner product status. Defaults to DRAFT.',
  })
  @Transform(normalizeEnum)
  @IsEnum(PartnerProductStatus)
  @IsOptional()
  status?: PartnerProductStatus;
}
