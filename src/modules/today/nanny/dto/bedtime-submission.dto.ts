import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class NannyBedtimeSubmissionDto {
  @ApiPropertyOptional({
    example: 'Eve listened calmly and asked for the forest story again.',
  })
  @IsString()
  @IsOptional()
  nannyNote?: string;

  @ApiPropertyOptional({
    example: {
      childMood: 'sleepy',
      listenedFully: true,
      parentAudioPlayed: true,
    },
  })
  @IsObject()
  @IsOptional()
  feedback?: Record<string, unknown>;
}
