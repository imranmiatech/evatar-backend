import { ApiProperty } from '@nestjs/swagger';
import { IdentityDocType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional } from 'class-validator';

export class UploadDocumentDto {
  @ApiProperty({
    description: 'Document type: PASSPORT or NATIONAL_ID',
    enum: IdentityDocType,
    example: IdentityDocType.PASSPORT,
  })
  @IsNotEmpty()
  @IsEnum(IdentityDocType)
  docType!: IdentityDocType;

  @ApiProperty({
    description: 'Passport Image / PDF File (Required when docType is PASSPORT)',
    type: 'string',
    format: 'binary',
    required: false,
  })
  @IsOptional()
  passport?: any;

  @ApiProperty({
    description: 'National ID Front Image / PDF File (Required when docType is NATIONAL_ID)',
    type: 'string',
    format: 'binary',
    required: false,
  })
  @IsOptional()
  nidFront?: any;

  @ApiProperty({
    description: 'National ID Back Image / PDF File (Optional for NATIONAL_ID)',
    type: 'string',
    format: 'binary',
    required: false,
  })
  @IsOptional()
  nidBack?: any;
}
