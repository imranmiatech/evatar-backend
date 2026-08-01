import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RewardOfferChannel } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateRewardOfferDto {
  @ApiPropertyOptional({
    description:
      'Store ID owned by the partner. Optional if the partner has one store.',
  })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({
    description:
      'JSON array string or comma-separated store IDs for branches where this offer is available.',
    example: '["store-id-1","store-id-2"]',
  })
  @IsOptional()
  @IsString()
  storeIds?: string;

  @ApiProperty({ example: '20% off Serenity Spa baby care pack' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Serenity Spa baby care pack' })
  @IsString()
  productName: string;

  @ApiPropertyOptional({
    example: 'Holistic wellness essentials for families.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: "What's included" })
  @IsOptional()
  @IsString()
  includedTitle?: string;

  @ApiPropertyOptional({
    example:
      'Get 25% discount with 300 Alurei. Applied directly at checkout or shown in-store.',
  })
  @IsOptional()
  @IsString()
  includedDescription?: string;

  @ApiPropertyOptional({
    example: 'Valid once per user. Cannot be combined with other offers.',
  })
  @IsOptional()
  @IsString()
  terms?: string;

  @ApiPropertyOptional({ example: 'https://example.com/product.png' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    enum: RewardOfferChannel,
    description: 'ONLINE gives coupon, IN_STORE gives QR, BOTH supports both.',
    example: RewardOfferChannel.BOTH,
  })
  @IsOptional()
  @IsEnum(RewardOfferChannel)
  channel?: RewardOfferChannel;

  @ApiPropertyOptional({
    description:
      'Coupon shown for online claims. If omitted, system code is used.',
    example: 'ALUREI15',
  })
  @IsOptional()
  @IsString()
  onlineCouponCode?: string;

  @ApiPropertyOptional({
    description: 'Partner checkout or product page URL for online claims.',
    example: 'https://partner.example.com/alurei-offer',
  })
  @IsOptional()
  @IsString()
  websiteUrl?: string;

  @ApiProperty({
    description:
      'Exact number of reward points needed to claim this product offer.',
    example: 50,
  })
  @IsInt()
  @Min(1)
  pointsCost: number;

  @ApiPropertyOptional({
    description: 'Total quantity that can be redeemed. Omit for unlimited.',
    example: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  availableQuantity?: number;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({
    description:
      'JSON array string for multipart form-data. Example: [{"name":"Dubai Mall","address":"Downtown Dubai, Level LG","city":"Dubai"}]',
  })
  @IsOptional()
  @IsString()
  locations?: string;
}
