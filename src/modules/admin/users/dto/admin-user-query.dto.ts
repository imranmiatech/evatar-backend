import { IsOptional, IsString, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum AdminUserRoleFilter {
  ALL = 'ALL',
  PARENT = 'PARENT',
  NANNY = 'NANNY',
  PARTNER = 'PARTNER',
  ADMIN = 'ADMIN',
}

export enum AdminUserStatusFilter {
  ALL = 'ALL',
  ACTIVE = 'ACTIVE',
  TRIAL = 'TRIAL',
  SUSPENDED = 'SUSPENDED',
  INACTIVE = 'INACTIVE',
}

export enum AdminUserPlanFilter {
  ALL = 'ALL',
  STARTER = 'STARTER',
  FAMILY = 'FAMILY',
  PREMIUM = 'PREMIUM',
  FREE_TRIAL = 'FREE_TRIAL',
}

export class AdminUserQueryDto {
  @ApiPropertyOptional({ description: 'Search term for name, email, or phone' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: AdminUserRoleFilter, description: 'Filter by user role' })
  @IsOptional()
  @IsEnum(AdminUserRoleFilter)
  role?: AdminUserRoleFilter;

  @ApiPropertyOptional({ enum: AdminUserStatusFilter, description: 'Filter by status (ACTIVE, TRIAL, SUSPENDED)' })
  @IsOptional()
  @IsEnum(AdminUserStatusFilter)
  status?: AdminUserStatusFilter;

  @ApiPropertyOptional({ enum: AdminUserPlanFilter, description: 'Filter by plan (STARTER, FAMILY, PREMIUM)' })
  @IsOptional()
  @IsEnum(AdminUserPlanFilter)
  plan?: AdminUserPlanFilter;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}
