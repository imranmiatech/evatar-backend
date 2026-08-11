import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  KitchenInventoryItemStatus,
  KitchenItemCategory,
  UserRole,
} from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';

export enum KitchenItemTab {
  ALL = 'ALL',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export class KitchenItemQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Search by item name or notes',
    example: 'Almond',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    enum: KitchenItemCategory,
    description: 'Filter by item category',
    example: KitchenItemCategory.PANTRY,
  })
  @IsEnum(KitchenItemCategory)
  @IsOptional()
  category?: KitchenItemCategory;

  @ApiPropertyOptional({
    enum: KitchenItemTab,
    description: 'Filter list tab: ALL, ACTIVE, or ARCHIVED',
    example: KitchenItemTab.ALL,
    default: KitchenItemTab.ALL,
  })
  @IsEnum(KitchenItemTab)
  @IsOptional()
  tab?: KitchenItemTab = KitchenItemTab.ALL;

  @ApiPropertyOptional({
    enum: KitchenInventoryItemStatus,
    description: 'Filter by stock status',
    example: KitchenInventoryItemStatus.MISSING,
  })
  @IsEnum(KitchenInventoryItemStatus)
  @IsOptional()
  status?: KitchenInventoryItemStatus;

  @ApiPropertyOptional({
    enum: UserRole,
    description: 'Filter by creator role',
    example: UserRole.ADMIN,
  })
  @IsEnum(UserRole)
  @IsOptional()
  ownerStatus?: UserRole;
}
