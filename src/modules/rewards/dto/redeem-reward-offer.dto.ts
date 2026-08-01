import { ApiPropertyOptional } from '@nestjs/swagger';
import { RewardClaimMethod } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class RedeemRewardOfferDto {
  @ApiPropertyOptional({
    enum: RewardClaimMethod,
    description:
      'Required when offer channel is BOTH. ONLINE returns coupon, IN_STORE returns QR.',
    example: RewardClaimMethod.ONLINE,
  })
  @IsOptional()
  @IsEnum(RewardClaimMethod)
  claimMethod?: RewardClaimMethod;

  @ApiPropertyOptional({
    description: 'Selected store branch ID for in-store claim flow.',
    example: 'db1df5d6-3f58-4c87-9f70-7e6c0cb9d1f2',
  })
  @IsOptional()
  @IsString()
  storeId?: string;
}
