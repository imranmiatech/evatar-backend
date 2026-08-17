import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export enum MyOfferTabFilter {
  ALL = 'ALL',
  SAVED = 'SAVED',
}

export class MyOfferQueryDto {
  @ApiPropertyOptional({
    enum: MyOfferTabFilter,
    default: MyOfferTabFilter.ALL,
    description: 'Filter tab: ALL for all active offers, SAVED for bookmarked offers',
  })
  @IsEnum(MyOfferTabFilter)
  @IsOptional()
  tab?: MyOfferTabFilter = MyOfferTabFilter.ALL;

  @ApiPropertyOptional({
    description: 'Optional search keyword by offer title, description, or partner store name',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}

export class RedeemInStoreDto {
  @ApiPropertyOptional({
    description: 'Scanned QR code or barcode string payload from partner store counter',
    example: 'STORE_QR_DUBAI_MALL_123',
  })
  @IsString()
  @IsOptional()
  qrPayload?: string;

  @ApiPropertyOptional({
    description: 'Store location ID if selected from locations list',
    example: 'loc-uuid-123',
  })
  @IsString()
  @IsOptional()
  storeLocationId?: string;
}
