import { ApiPropertyOptional } from '@nestjs/swagger';
import { CareModuleAdminStatus, CareModuleCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AdminCareModuleQueryDto {
  @ApiPropertyOptional({ enum: CareModuleAdminStatus })
  @IsEnum(CareModuleAdminStatus)
  @IsOptional()
  adminStatus?: CareModuleAdminStatus;

  @ApiPropertyOptional({ enum: CareModuleCategory })
  @IsEnum(CareModuleCategory)
  @IsOptional()
  category?: CareModuleCategory;

  @ApiPropertyOptional({
    description: 'Filter by age group (e.g. 6-12 months, 1-3 years)',
  })
  @IsString()
  @IsOptional()
  ageGroup?: string;

  @ApiPropertyOptional({ description: 'Search by title/subtitle' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 20;
}
