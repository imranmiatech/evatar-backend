import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreatePartnerStoreDto {
  @ApiProperty({ example: 'Dubai Mall' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Downtown Dubai, Level LG' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Dubai' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Partner branch for reward redemptions.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/store-logo.png' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: 25.1972 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: 55.2796 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({
    example: 'https://maps.google.com/?q=25.1972,55.2796',
  })
  @IsOptional()
  @IsString()
  mapUrl?: string;
}

export class UpdatePartnerStoreDto extends PartialType(CreatePartnerStoreDto) {}
