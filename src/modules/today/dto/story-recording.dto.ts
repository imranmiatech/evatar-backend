import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBedtimeStoryDto {
  @ApiProperty({ example: "Eve's bedtime story" })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    example: 'Tonight Eve rests after a gentle day of play and care.',
  })
  @IsString()
  @IsNotEmpty()
  storyText!: string;

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
}

export class UpdateBedtimeStoryDto {
  @ApiPropertyOptional({ example: "Eve's Magical Forest Story" })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    example: 'Today Eve awoke excited for a new adventure...',
  })
  @IsString()
  @IsOptional()
  storyText?: string;

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
}

export class CreateRecordingUploadUrlDto {
  @ApiProperty({ example: 'audio/m4a' })
  @IsString()
  @IsNotEmpty()
  mimeType!: string;
}

export class CompleteRecordingDto {
  @ApiProperty({ example: 'story-recordings/user-id/story-id.m4a' })
  @IsString()
  @IsNotEmpty()
  storageKey!: string;

  @ApiProperty({ example: 'https://cdn.example.com/story.m4a' })
  @IsString()
  @IsNotEmpty()
  audioUrl!: string;

  @ApiPropertyOptional({ example: 122 })
  @IsInt()
  @IsOptional()
  durationSec?: number;
}
