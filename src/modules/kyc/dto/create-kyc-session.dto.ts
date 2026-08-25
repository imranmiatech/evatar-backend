import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class CreateKycSessionDto {
  @ApiPropertyOptional({
    description: 'Two-letter language code for Sumsub SDK localization',
    example: 'en',
  })
  @IsOptional()
  @IsString()
  @Length(2, 8)
  lang?: string;

  @ApiPropertyOptional({
    description:
      'Existing Sumsub applicant action externalActionId for refreshing an action-bound SDK token',
    example: 'kyc-liveness-user-id-1724518500000',
  })
  @IsOptional()
  @IsString()
  @Length(3, 255)
  externalActionId?: string;

  @ApiPropertyOptional({
    description:
      'Optional Sumsub level override, used for action-bound WebSDK token refresh',
    example: 'shared-live-selfie-action',
  })
  @IsOptional()
  @IsString()
  @Length(3, 255)
  levelNameOverride?: string;
}
