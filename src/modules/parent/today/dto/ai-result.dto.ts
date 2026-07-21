import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ManualActivityDto } from './manual-day-plan.dto';

export class GeneratedStoryDto {
  @ApiProperty({ example: "Eve's Magical Forest Story" })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Today Eve awoke excited for a new adventure...' })
  @IsString()
  @IsNotEmpty()
  storyText: string;

  @ApiPropertyOptional({
    example: 'Warm bedtime forest illustration with Eve.',
  })
  @IsString()
  @IsOptional()
  imagePrompt?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/story-cover.png' })
  @IsString()
  @IsOptional()
  coverImageUrl?: string;

  @ApiPropertyOptional({ example: 'openai' })
  @IsString()
  @IsOptional()
  aiProvider?: string;

  @ApiPropertyOptional({ example: 'gpt-5' })
  @IsString()
  @IsOptional()
  aiModel?: string;
}

export class CompleteAiResultDto {
  @ApiPropertyOptional({ type: [ManualActivityDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualActivityDto)
  @IsOptional()
  activities?: ManualActivityDto[];

  @ApiProperty({ type: GeneratedStoryDto })
  @ValidateNested()
  @Type(() => GeneratedStoryDto)
  story: GeneratedStoryDto;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  aiOutput?: Record<string, unknown>;
}
