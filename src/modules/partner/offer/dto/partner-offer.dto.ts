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

const normalizeBoolean = ({ value }: { value: unknown }) =>
  value === true || value === 'true' || value === '1';

export class PartnerOfferLocationDto {
  @ApiPropertyOptional({ description: 'Existing partner store/outlet ID.' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiProperty({ example: 'Dubai Mall' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'Downtown Dubai, Level LG' })
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

export class CreatePartnerOfferDto {
  @ApiPropertyOptional({
    enum: [PartnerOfferStatus.DRAFT, PartnerOfferStatus.PENDING_APPROVAL],
    description:
      'Use DRAFT for Save Draft and PENDING_APPROVAL for Submit for review. Defaults to PENDING_APPROVAL.',
  })
  @IsOptional()
  @Transform(normalizeEnum)
  @IsIn([PartnerOfferStatus.DRAFT, PartnerOfferStatus.PENDING_APPROVAL])
  status?: PartnerOfferStatus;

  @ApiProperty({ enum: PartnerOfferRedemptionFlow, example: 'IN_STORE' })
  @Transform(normalizeEnum)
  @IsEnum(PartnerOfferRedemptionFlow)
  redemptionFlow!: PartnerOfferRedemptionFlow;

  @ApiProperty({ enum: PartnerOfferType, example: 'FIXED_DISCOUNT' })
  @Transform(normalizeEnum)
  @IsEnum(PartnerOfferType)
  offerType!: PartnerOfferType;

  @ApiProperty({ example: 'Free Yoga for Parents' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ example: 'Grab 25% discount with 300 ALR' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/banner.jpg' })
  @IsOptional()
  @IsString()
  heroImageUrl?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(normalizeBoolean)
  @IsBoolean()
  useDefaultHeroImage?: boolean;

  @ApiPropertyOptional({ description: 'Required for product based offers.' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ example: 'Organic Yogurt' })
  @IsOptional()
  @IsString()
  productName?: string;

  @ApiPropertyOptional({ enum: PartnerProductCategory, example: 'PRODUCE' })
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

  @ApiPropertyOptional({
    type: [String],
    example: ['Free', 'Starter', 'Family', 'Premium'],
  })
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
    example: 'AED 30 instant discount. Applied directly at checkout.',
  })
  @IsOptional()
  @IsString()
  benefitDescription?: string;

  @ApiPropertyOptional({
    example: 'Valid for one shop only. Cannot be combined with other offers.',
  })
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

  @ApiPropertyOptional({ type: [PartnerOfferLocationDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PartnerOfferLocationDto)
  locations?: PartnerOfferLocationDto[];
}

export class UpdatePartnerOfferDto extends PartialType(CreatePartnerOfferDto) {}

export class PartnerOfferQueryDto {
  @ApiPropertyOptional({
    enum: [
      'ALL',
      'ACTIVE',
      'SCHEDULED',
      'PENDING_APPROVAL',
      'EXPIRED',
      'REJECTED',
      'DRAFT',
      'INACTIVE',
    ],
  })
  @IsOptional()
  @Transform(normalizeEnum)
  @IsIn([
    'ALL',
    'ACTIVE',
    'SCHEDULED',
    'PENDING_APPROVAL',
    'EXPIRED',
    'REJECTED',
    'DRAFT',
    'INACTIVE',
  ])
  status?: string;

  @ApiPropertyOptional({
    example: 'Baby Organic Yogurt',
    description: 'Search offer title, product name, description, or benefit.',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: PartnerOfferType })
  @IsOptional()
  @Transform(normalizeEnum)
  @IsEnum(PartnerOfferType)
  offerType?: PartnerOfferType;

  @ApiPropertyOptional({ enum: PartnerOfferRedemptionFlow })
  @IsOptional()
  @Transform(normalizeEnum)
  @IsEnum(PartnerOfferRedemptionFlow)
  redemptionFlow?: PartnerOfferRedemptionFlow;

  @ApiPropertyOptional({ enum: PartnerProductCategory })
  @IsOptional()
  @Transform(normalizeEnum)
  @IsEnum(PartnerProductCategory)
  category?: PartnerProductCategory;

  @ApiPropertyOptional({
    example: '2026-08-01T00:00:00.000Z',
    description: 'Return offers ending on or after this date.',
  })
  @IsOptional()
  @IsDateString()
  startDateFrom?: string;

  @ApiPropertyOptional({
    example: '2026-10-31T23:59:59.000Z',
    description: 'Return offers starting on or before this date.',
  })
  @IsOptional()
  @IsDateString()
  endDateTo?: string;

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

export class RejectPartnerOfferDto {
  @ApiPropertyOptional({
    example: 'Please clarify the benefit terms before resubmitting.',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
