import { ApiProperty } from '@nestjs/swagger';
import { IdentityDocType } from '@prisma/client';
import { IsIn, IsNotEmpty, IsOptional } from 'class-validator';

const MY_DOCUMENT_ALLOWED_DOC_TYPES = [
  IdentityDocType.PASSPORT,
  IdentityDocType.NATIONAL_ID,
] as const;

export class UploadDocumentDto {
  @ApiProperty({
    description:
      'High-level document category for the current KYC upload flow.',
    enum: MY_DOCUMENT_ALLOWED_DOC_TYPES,
    example: IdentityDocType.PASSPORT,
  })
  @IsNotEmpty()
  @IsIn(MY_DOCUMENT_ALLOWED_DOC_TYPES)
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
