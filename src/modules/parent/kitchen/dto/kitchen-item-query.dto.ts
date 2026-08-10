import { ApiPropertyOptional } from '@nestjs/swagger';
import { KitchenInventoryItemStatus, UserRole } from '@prisma/client';
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
    enum: UserRole,
    description: 'Filter by creator role',
    example: UserRole.ADMIN,
  })
  @IsEnum(UserRole)
  @IsOptional()
  ownerStatus?: UserRole;
}
