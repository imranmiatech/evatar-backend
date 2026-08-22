import { ApiProperty } from '@nestjs/swagger';
import { IdentityDocType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class SubmitDocumentsDto {
  @ApiProperty({
    enum: IdentityDocType,
    example: IdentityDocType.PASSPORT,
    description:
      'High-level identity document category selected in your custom UI.',
  })
  @IsEnum(IdentityDocType)
  docType!: IdentityDocType;

  @ApiProperty({
    example: 'USA',
    description: 'Issuing country in ISO 3166-1 alpha-3 format.',
  })
  @IsString()
  @Length(3, 3)
  countryCode!: string;

  @ApiProperty({
    required: false,
    example: 'DRIVERS',
    description:
      'Optional exact Sumsub idDocType override. Required when docType is OTHER.',
  })
  @IsOptional()
  @IsString()
  sumsubIdDocType?: string;
}
