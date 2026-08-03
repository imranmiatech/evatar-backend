import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CreateKitchenItemDto } from './create-kitchen-item.dto';
import { KitchenItemAdminStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateKitchenItemDto extends PartialType(CreateKitchenItemDto) {}

export class UpdateAdminStatusDto {
  @ApiPropertyOptional({
    enum: KitchenItemAdminStatus,
    description: 'Target admin status (ACTIVE or ARCHIVE). If omitted, toggles current status.',
    example: KitchenItemAdminStatus.ARCHIVE,
  })
  @IsEnum(KitchenItemAdminStatus)
  @IsOptional()
  adminStatus?: KitchenItemAdminStatus;
}

