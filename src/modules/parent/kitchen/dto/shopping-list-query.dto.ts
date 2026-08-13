import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';

export class ShoppingListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: UserRole,
    description: 'Filter by creator role',
    example: UserRole.PARENT,
  })
  @IsEnum(UserRole)
  @IsOptional()
  ownerStatus?: UserRole;
}
