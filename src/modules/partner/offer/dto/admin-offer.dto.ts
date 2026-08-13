import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  PartnerOfferRedemptionFlow,
  PartnerOfferStatus,
  PartnerOfferType,
  PartnerProductCategory,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
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

const normalizeOfferType = ({ value }: { value: unknown }) => {
  const normalized = normalizeEnum({ value });
  if (normalized === 'FIXED') return PartnerOfferType.FIXED_DISCOUNT;
  if (normalized === 'PRODUCT') return PartnerOfferType.PRODUCT_BASED;
  return normalized;
};

const normalizeBoolean = ({ value }: { value: unknown }) =>
  value === true || value === 'true' || value === '1';

const normalizeStringArray = ({ value }: { value: unknown }) => {
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

const normalizeLocations = ({ value }: { value: unknown }) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export class AdminOfferPartnerQueryDto {
  @ApiPropertyOptional({ example: 'Yogi Bear' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class AdminOfferLocationDto {
  @ApiPropertyOptional({ description: 'Existing partner store/outlet ID.' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiProperty({ example: 'Dubai Mall' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'Downtown Dubai' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Dubai' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'https://maps.google.com/...' })
  @IsOptional()
  @IsString()
  mapUrl?: string;

  @ApiPropertyOptional({ example: 25.1972 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: 55.2744 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;
}

export class CreateAdminPartnerOfferDto {
  @ApiProperty({ example: 'cmrwwed7q0000aalr1ka7hzth' })
  @IsUUID()
  partnerUserId!: string;

  @ApiPropertyOptional({
    enum: [
      PartnerOfferStatus.ACTIVE,
      PartnerOfferStatus.DRAFT,
      PartnerOfferStatus.INACTIVE,
    ],
    example: PartnerOfferStatus.ACTIVE,
  })
  @IsOptional()
  @Transform(normalizeEnum)
  @IsIn([
    PartnerOfferStatus.ACTIVE,
    PartnerOfferStatus.DRAFT,
    PartnerOfferStatus.INACTIVE,
  ])
  status?: PartnerOfferStatus;

  @ApiProperty({ enum: PartnerOfferRedemptionFlow, example: 'IN_STORE' })
  @Transform(normalizeEnum)
  @IsEnum(PartnerOfferRedemptionFlow)
  redemptionFlow!: PartnerOfferRedemptionFlow;

  @ApiProperty({
    enum: PartnerOfferType,
    example: 'FIXED_DISCOUNT',
    description: 'Accepts FIXED_DISCOUNT/FIXED or PRODUCT_BASED/PRODUCT.',
  })
  @Transform(normalizeOfferType)
  @IsEnum(PartnerOfferType)
  offerType!: PartnerOfferType;

  @ApiProperty({ example: 'Free Yoga for Parents' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ example: 'Grab 25% discount with 300 ALR' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(normalizeBoolean)
  @IsBoolean()
  useDefaultHeroImage?: boolean;

  @ApiPropertyOptional({ description: 'Existing product ID for product offers.' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ example: 'Care for' })
  @IsOptional()
  @IsString()
  productName?: string;

  @ApiPropertyOptional({ enum: PartnerProductCategory })
  @IsOptional()
  @Transform(normalizeEnum)
  @IsEnum(PartnerProductCategory)
  category?: PartnerProductCategory;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minimumSpend?: number;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  deductionPercentage?: number;

  @ApiProperty({ example: 300 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  requiredAlurei!: number;

  @ApiPropertyOptional({ example: ['Free', 'Starter', 'Family', 'Premium'] })
  @IsOptional()
  @Transform(normalizeStringArray)
  @IsArray()
  @IsString({ each: true })
  eligiblePlans?: string[];

  @ApiPropertyOptional({ example: 'Grab 25% discount with 300 Alurei' })
  @IsOptional()
  @IsString()
  benefitTitle?: string;

  @ApiPropertyOptional({
    example: 'Explain what the user receives at checkout.',
  })
  @IsOptional()
  @IsString()
  benefitDescription?: string;

  @ApiPropertyOptional({ example: 'Valid for one shop only.' })
  @IsOptional()
  @IsString()
  terms?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(normalizeBoolean)
  @IsBoolean()
  availableAllOutlets?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(normalizeBoolean)
  @IsBoolean()
  recommendExternal?: boolean;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-10-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ type: [AdminOfferLocationDto] })
  @IsOptional()
  @Transform(normalizeLocations)
  @ValidateNested({ each: true })
  @Type(() => AdminOfferLocationDto)
  locations?: AdminOfferLocationDto[];

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Banner image file field for multipart/form-data.',
  })
  @IsOptional()
  image?: unknown;
}

export class UpdateAdminPartnerOfferDto extends PartialType(
  CreateAdminPartnerOfferDto,
) {}
