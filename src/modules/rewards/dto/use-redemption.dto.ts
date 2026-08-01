import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UseRedemptionDto {
  @ApiPropertyOptional({
    description: 'QR token scanned from in-store redemption.',
    example: 'QR-A1B2C3D4E5F6',
  })
  @IsOptional()
  @IsString()
  qrToken?: string;

  @ApiPropertyOptional({
    description: 'Offer ID for in-store claim flow.',
    example: '76223a72-fa0f-4b57-8529-c60efedec344',
  })
  @IsOptional()
  @IsString()
  offerId?: string;

  @ApiPropertyOptional({
    description:
      'Store branch ID for in-store claim flow. Used to verify the scanned store.',
    example: 'db1df5d6-3f58-4c87-9f70-7e6c0cb9d1f2',
  })
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiPropertyOptional({
    description:
      'Unique redemption code. Shared online coupon text is not enough to mark a specific redemption used.',
    example: 'ALR-1A2B3C4D',
  })
  @IsOptional()
  @IsString()
  code?: string;
}
