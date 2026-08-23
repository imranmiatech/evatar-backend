import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const ADMIN_TOP_REWARD_OFFER_STATUSES = [
  'ALL',
  'ACTIVE',
  'EXPIRED',
  'SCHEDULED',
  'INACTIVE',
  'DRAFT',
] as const;

export type AdminTopRewardOfferStatus =
  (typeof ADMIN_TOP_REWARD_OFFER_STATUSES)[number];

export class AdminTopRewardOffersQueryDto {
  @ApiPropertyOptional({
    example: 5,
    minimum: 1,
    maximum: 50,
    description: 'How many top offers to return. Defaults to 5.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({
    enum: ADMIN_TOP_REWARD_OFFER_STATUSES,
    example: 'ALL',
    description:
      'Optional table filter. SCHEDULED is a derived state for future-start offers.',
  })
  @IsOptional()
  @IsIn(ADMIN_TOP_REWARD_OFFER_STATUSES)
  status?: AdminTopRewardOfferStatus;
}
