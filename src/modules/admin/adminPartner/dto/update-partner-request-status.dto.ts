import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PartnerRequestAdminStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';

const normalizeEnum = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  return value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
};

export class UpdatePartnerRequestStatusDto {
  @ApiProperty({
    enum: PartnerRequestAdminStatus,
    example: PartnerRequestAdminStatus.CONTACTED,
  })
  @Transform(normalizeEnum)
  @IsEnum(PartnerRequestAdminStatus)
  status!: PartnerRequestAdminStatus;

  @ApiPropertyOptional({
    example: 'Called the contact person and waiting for business documents.',
  })
  @IsString()
  @IsOptional()
  adminNote?: string;
}
