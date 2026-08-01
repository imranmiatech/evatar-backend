import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { RewardOfferStatus } from '@prisma/client';
import { CreateRewardOfferDto } from './create-reward-offer.dto';

export class UpdateRewardOfferDto extends PartialType(CreateRewardOfferDto) {
  @IsOptional()
  @IsEnum(RewardOfferStatus)
  status?: RewardOfferStatus;
}
