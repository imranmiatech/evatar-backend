import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDate,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class UpdateMyNannyPortfolioExperienceDto {
  @ApiPropertyOptional({ example: 'The Rahman Family' })
  @IsString()
  familyName!: string;

  @ApiPropertyOptional({ example: '2024-01-01T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @ApiPropertyOptional({ example: '2025-06-01T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  childrenCount?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  infantsCount?: number;

  @ApiPropertyOptional({
    example: 'Managed routines, meals, and learning activities for two children.',
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateMyNannyPortfolioDto {
  @ApiPropertyOptional({
    type: [String],
    example: ['Infant care', 'Meal planning', 'Sleep routine support'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  skills?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['First Aid', 'Montessori Basics', 'Child Safety'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  training?: string[];

  @ApiPropertyOptional({
    type: [UpdateMyNannyPortfolioExperienceDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateMyNannyPortfolioExperienceDto)
  professionalExperience?: UpdateMyNannyPortfolioExperienceDto[];
}
