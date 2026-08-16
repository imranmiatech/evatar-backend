import { ApiPropertyOptional } from '@nestjs/swagger';
import { RewardOfferStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class RewardOfferQueryDto {
  @ApiPropertyOptional({ enum: RewardOfferStatus })
  @IsOptional()
  @IsEnum(RewardOfferStatus)
  status?: RewardOfferStatus;

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
