import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateGuidedDayPlanDto {
  @ApiProperty({ example: '2026-07-19' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({
    example: {
      childMood: 'excited',
      meal: 'honey-drizzled banana oat pancakes',
      storyTheme: 'magical forest',
      tone: 'soft bedtime',
    },
  })
  @IsObject()
  @IsOptional()
  guidedAnswers?: Record<string, unknown>;
}

export class UpdateGuidedAnswersDto {
  @ApiProperty({
    example: {
      childMood: 'excited',
      activities: ['play garden', 'blocks'],
      includeValues: ['kindness', 'sharing'],
    },
  })
  @IsObject()
  @IsNotEmpty()
  guidedAnswers: Record<string, unknown>;
}

export class RequestAiGenerationDto {
  @ApiPropertyOptional({ example: 'openai' })
  @IsString()
  @IsOptional()
  aiProvider?: string;

  @ApiPropertyOptional({ example: 'gpt-5' })
  @IsString()
  @IsOptional()
  aiModel?: string;
}
