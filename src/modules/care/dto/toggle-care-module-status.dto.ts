import { ApiPropertyOptional } from '@nestjs/swagger';
import { CareModuleAdminStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ToggleCareModuleStatusDto {
  @ApiPropertyOptional({
    enum: CareModuleAdminStatus,
    example: CareModuleAdminStatus.PUBLISHED,
    description: 'Target admin status (PUBLISHED or DRAFT). If omitted, toggles current status.',
  })
  @IsEnum(CareModuleAdminStatus)
  @IsOptional()
  adminStatus?: CareModuleAdminStatus;
}
