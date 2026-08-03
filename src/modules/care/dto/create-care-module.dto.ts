import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CareModuleAdminStatus, CareModuleCategory, CareQuestionType, Prisma } from '@prisma/client';
import { plainToInstance, Transform, Type } from 'class-transformer';
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

  @Transform(({ value }) => {
    if (typeof value === 'string') return value === 'true';
    return Boolean(value);
  })
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

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  })
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

  @ApiPropertyOptional({ description: 'Optional cover image file field for multipart/form-data' })
  @IsString()
  @IsOptional()
  coverImage?: string;

  @ApiPropertyOptional({ example: 'https://example.com/video.mp4' })
  @IsString()
  @IsOptional()
  videoUrl?: string;

  @ApiPropertyOptional({ description: 'Optional video file field for multipart/form-data' })
  @IsString()
  @IsOptional()
  video?: string;

  @ApiPropertyOptional({ example: 'Variability in appetite is normal in childhood...' })
  @IsString()
  @IsOptional()
  keyTakeaway?: string;

  @ApiProperty({
    enum: CareModuleCategory,
    example: CareModuleCategory.CHILD_DEVELOPMENT,
  })
  @IsEnum(CareModuleCategory)
  category!: CareModuleCategory;

  @ApiPropertyOptional({ example: 15 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  estimatedMinutes?: number;

  @ApiPropertyOptional({ example: 5 })
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

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  })
  @ApiProperty({
    description:
      'Structured lesson content sections. Example keys: realLifeSituation, whatsHappening, whyItHappens, practicalSupport, keyTakeaway.',
  })
  @IsObject()
  contentSections!: Prisma.InputJsonValue;

  @Transform(({ value }) => {
    if (typeof value === 'string') return value === 'true';
    return value;
  })
  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;

  @ApiPropertyOptional({ enum: CareModuleAdminStatus, example: CareModuleAdminStatus.PUBLISHED })
  @IsEnum(CareModuleAdminStatus)
  @IsOptional()
  adminStatus?: CareModuleAdminStatus;

  @ApiPropertyOptional({ example: '1-3 years' })
  @IsString()
  @IsOptional()
  ageGroup?: string;

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed)
          ? parsed.map((item: any) => plainToInstance(CreateCareQuizQuestionDto, item))
          : parsed;
      } catch {
        return value;
      }
    }
    if (Array.isArray(value)) {
      return value.map((item: any) => plainToInstance(CreateCareQuizQuestionDto, item));
    }
    return value;
  })
  @ApiProperty({ type: [CreateCareQuizQuestionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateCareQuizQuestionDto)
  questions!: CreateCareQuizQuestionDto[];
}
