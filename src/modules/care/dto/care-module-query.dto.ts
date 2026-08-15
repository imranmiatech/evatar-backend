import {
  ApiHideProperty,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { CareModuleAdminStatus, CareModuleCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export enum CareModuleTab {
  ALL = 'ALL',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  SAVED = 'SAVED',
}

export class CareModuleQueryDto {
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

  @ApiPropertyOptional({ enum: CareModuleTab, default: CareModuleTab.ALL })
  @IsEnum(CareModuleTab)
  @IsOptional()
  tab?: CareModuleTab = CareModuleTab.ALL;

  @ApiPropertyOptional({ description: 'Search by title/subtitle' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter assignments by child id' })
  @IsString()
  @IsOptional()
  childId?: string;

  @ApiPropertyOptional({ description: 'Filter assignments by nanny user id' })
  @IsString()
  @IsOptional()
  nannyUserId?: string;

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

export class CareHomeQueryDto {
  @ApiPropertyOptional({
    enum: CareModuleTab,
    default: CareModuleTab.ALL,
    description: 'Filter module list by Care Hub tab.',
  })
  @IsEnum(CareModuleTab)
  @IsOptional()
  tab?: CareModuleTab = CareModuleTab.ALL;

  @ApiPropertyOptional({
    description: 'Search by title, subtitle, description, or topic keyword',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description:
      'Filter module list by topic id from /care/home/topics. Use ALL for all topics.',
    enum: ['ALL', ...Object.values(CareModuleCategory)],
  })
  @IsString()
  @IsOptional()
  topicId?: string;

  @ApiPropertyOptional({ description: 'Filter modules by child id' })
  @IsString()
  @IsOptional()
  childId?: string;

  @ApiPropertyOptional({ description: 'Filter assignments by nanny user id' })
  @IsString()
  @IsOptional()
  nannyUserId?: string;

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

  @ApiHideProperty()
  @IsOptional()
  adminStatus?: CareModuleAdminStatus;

  @ApiHideProperty()
  @IsOptional()
  ageGroup?: string;

  @ApiHideProperty()
  @IsOptional()
  category?: CareModuleCategory;
}

export class CareHomeTabsQueryDto {
  @ApiProperty({ description: 'Filter counts by child id' })
  @IsString()
  childId?: string;
}
