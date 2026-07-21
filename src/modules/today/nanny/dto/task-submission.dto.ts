import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class NannyTaskSubmissionDto {
  @ApiPropertyOptional({
    enum: ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'],
    example: 'COMPLETED',
  })
  @IsIn(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    example: ['media-proof-id-1', 'media-proof-id-2'],
    description:
      'Uploaded MediaAsset ids. The first one is mirrored to DayActivity.proofMediaId.',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  proofMediaIds?: string[];

  @ApiPropertyOptional({
    example: {
      disposition: 'happy',
      details: ['Engaged well', 'Ate slowly'],
      completionRate: '90%',
    },
  })
  @IsObject()
  @IsOptional()
  checklist?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: {
      energy: 'calm',
      engagement: 'focused',
      appetite: 'good',
    },
  })
  @IsObject()
  @IsOptional()
  mood?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: {
      completedAt: '2026-07-20T13:00:00.000Z',
      durationMinutes: 30,
      needsParentReview: false,
    },
  })
  @IsObject()
  @IsOptional()
  completion?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: 'Completed breakfast and enjoyed the blueberries.',
  })
  @IsString()
  @IsOptional()
  nannyNote?: string;
}
