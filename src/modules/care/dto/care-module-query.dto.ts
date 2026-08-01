import { ApiPropertyOptional } from '@nestjs/swagger';
import { CareModuleCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export enum CareModuleTab {
  ALL = 'ALL',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  SAVED = 'SAVED',
}

export class CareModuleQueryDto {
  @ApiPropertyOptional({ enum: CareModuleCategory })
  @IsEnum(CareModuleCategory)
  @IsOptional()
  category?: CareModuleCategory;

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
