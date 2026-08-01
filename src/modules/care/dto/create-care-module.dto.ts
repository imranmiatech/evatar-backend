import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CareModuleCategory, CareQuestionType, Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateCareQuizOptionDto {
  @ApiProperty({ example: 'A mix of biology, emotion, and environment' })
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  isCorrect!: boolean;
}

export class CreateCareQuizQuestionDto {
  @ApiProperty({ example: 'What most influences children appetite?' })
  @IsString()
  @IsNotEmpty()
  question!: string;

  @ApiPropertyOptional({
    enum: CareQuestionType,
    example: CareQuestionType.SINGLE_CHOICE,
  })
  @IsEnum(CareQuestionType)
  @IsOptional()
  type?: CareQuestionType;

  @ApiProperty({
    example:
      'Appetite is dynamic and shaped by developing internal signals, emotional state, and growth patterns.',
  })
  @IsString()
  @IsNotEmpty()
  explanation!: string;

  @ApiProperty({ type: [CreateCareQuizOptionDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateCareQuizOptionDto)
  options!: CreateCareQuizOptionDto[];
}

export class CreateCareModuleDto {
  @ApiProperty({ example: 'Feeding & Mealtimes' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({
    example: 'Why children eating patterns naturally vary',
  })
  @IsString()
  @IsOptional()
  subtitle?: string;

  @ApiPropertyOptional({
    example:
      'Support caregivers with early childhood feeding habits and calm mealtime routines.',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/feeding.png' })
  @IsString()
  @IsOptional()
  coverImageUrl?: string;

  @ApiProperty({
    enum: CareModuleCategory,
    example: CareModuleCategory.FEEDING,
  })
  @IsEnum(CareModuleCategory)
  category!: CareModuleCategory;

  @ApiPropertyOptional({ example: 5 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  estimatedMinutes?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  coinReward?: number;

  @ApiPropertyOptional({
    description: 'Minimum child age in years for Suggested for Child section',
    example: 4,
  })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  suggestedMinAgeYears?: number;

  @ApiPropertyOptional({
    description: 'Maximum child age in years for Suggested for Child section',
    example: 5,
  })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  suggestedMaxAgeYears?: number;

  @ApiPropertyOptional({ example: 'Feeding & Mealtimes' })
  @IsString()
  @IsOptional()
  contentTitle?: string;

  @ApiProperty({
    description:
      'Structured lesson content sections. Example keys: realLifeSituation, whatsHappening, whyItHappens, practicalSupport, keyTakeaway.',
  })
  @IsObject()
  contentSections!: Prisma.InputJsonValue;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;

  @ApiProperty({ type: [CreateCareQuizQuestionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateCareQuizQuestionDto)
  questions!: CreateCareQuizQuestionDto[];
}
