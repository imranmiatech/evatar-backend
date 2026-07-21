import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { AddActivityDto } from './manual-day-plan.dto';

export class UpdateActivityDto extends PartialType(AddActivityDto) {
  @ApiPropertyOptional({
    enum: ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'],
  })
  @IsIn(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: 'Eve enjoyed this activity.' })
  @IsString()
  @IsOptional()
  nannyNote?: string;

  @ApiPropertyOptional({ example: 'Please repeat tomorrow.' })
  @IsString()
  @IsOptional()
  parentNote?: string;
}
