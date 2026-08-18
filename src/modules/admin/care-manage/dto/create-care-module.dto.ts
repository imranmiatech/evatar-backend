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

export class ModuleDescriptionDto {
  @ApiProperty({ example: 'Real-life situation' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ example: 'A child shouts or refuses a routine.' })
  @IsString()
  @IsNotEmpty()
  description!: string;
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
  shortDescription?: string;

  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'Optional cover image file field for multipart/form-data' })
  @IsOptional()
  coverImage?: any;


  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'Optional video file field for multipart/form-data' })
  @IsOptional()
  video?: any;

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

  @ApiPropertyOptional({ example: 50 })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  completionPoints?: number;

  @ApiPropertyOptional({ example: '6-12 months' })
  @IsString()
  @IsOptional()
  ageGroup?: string;

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed)
          ? parsed.map((item: any) => plainToInstance(ModuleDescriptionDto, item))
          : parsed;
      } catch {
        return value;
      }
    }
    if (Array.isArray(value)) {
      return value.map((item: any) => plainToInstance(ModuleDescriptionDto, item));
    }
    return value;
  })
  @ApiProperty({
    type: [ModuleDescriptionDto],
    description: 'Structured lesson content sections with title and description.',
    example: [
      {
        title: 'Real-life situation',
        description: 'A child shouts or refuses a routine.'
      }
    ]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModuleDescriptionDto)
  moduleDescriptions!: ModuleDescriptionDto[];


  @ApiPropertyOptional({ enum: CareModuleAdminStatus, example: CareModuleAdminStatus.PUBLISHED })
  @IsEnum(CareModuleAdminStatus)
  @IsOptional()
  adminStatus?: CareModuleAdminStatus;

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
  @ApiProperty({ 
    type: [CreateCareQuizQuestionDto],
    example: [
      {
        question: 'What most influences children appetite?',
        type: 'SINGLE_CHOICE',
        explanation: 'Appetite is dynamic and shaped by developing internal signals, emotional state, and growth patterns.',
        options: [
          {
            label: 'A mix of biology, emotion, and environment',
            isCorrect: true
          },
          {
            label: 'Only genetics',
            isCorrect: false
          }
        ]
      }
    ]
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateCareQuizQuestionDto)
  questions!: CreateCareQuizQuestionDto[];
}
