import { ApiProperty } from '@nestjs/swagger';
import { IdentityDocType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional } from 'class-validator';

export class UploadDocumentDto {
  @ApiProperty({
    description:
      'High-level document category for the current KYC upload flow.',
    enum: IdentityDocType,
    example: IdentityDocType.PASSPORT,
  })
  @IsNotEmpty()
  @IsEnum(IdentityDocType)
  docType!: IdentityDocType;

  @ApiProperty({
    description:
      'Single-file upload, typically used for passports in the legacy document screen.',
    type: 'string',
    format: 'binary',
    required: false,
  })
  @IsOptional()
  passport?: any;

  @ApiProperty({
    description:
      'Front-side upload for multi-side identity documents in the legacy document screen.',
    type: 'string',
    format: 'binary',
    required: false,
  })
  @IsOptional()
  nidFront?: any;

  @ApiProperty({
    description:
      'Back-side upload for multi-side identity documents in the legacy document screen.',
    type: 'string',
    format: 'binary',
    required: false,
  })
  @IsOptional()
  nidBack?: any;
}
