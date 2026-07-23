import { ApiProperty } from '@nestjs/swagger';
import { IdentityDocType } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class SubmitDocumentsDto {
  @ApiProperty({
    enum: IdentityDocType,
    example: IdentityDocType.NATIONAL_ID,
    description:
      'Use PASSPORT for one passport image, or NATIONAL_ID for front and back images.',
  })
  @IsEnum(IdentityDocType)
  docType!: IdentityDocType;
}
