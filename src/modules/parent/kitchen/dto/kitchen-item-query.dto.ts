import { ApiPropertyOptional } from '@nestjs/swagger';
import { KitchenInventoryItemStatus, KitchenItemAdminStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';

export class KitchenItemQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: KitchenInventoryItemStatus,
    description: 'Filter by stock status',
    example: KitchenInventoryItemStatus.MISSING,
  })
  @IsEnum(KitchenInventoryItemStatus)
  @IsOptional()
  status?: KitchenInventoryItemStatus;

  @ApiPropertyOptional({
    enum: KitchenItemAdminStatus,
    description: 'Filter by admin status (ACTIVE or ARCHIVE)',
    example: KitchenItemAdminStatus.ACTIVE,
  })
  @IsEnum(KitchenItemAdminStatus)
  @IsOptional()
  adminStatus?: KitchenItemAdminStatus;
}

