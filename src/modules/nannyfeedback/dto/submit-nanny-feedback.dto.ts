import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ActivityStatus,
  ChildMood,
  TaskCompletionRate,
  TaskEnjoymentLevel,
} from '@prisma/client';
import { Allow, IsEnum, IsOptional, IsString } from 'class-validator';

export class SubmitNannyFeedbackDto {
  @ApiPropertyOptional({
    enum: ActivityStatus,
    example: ActivityStatus.COMPLETED,
  })
  @IsOptional()
  @IsEnum(ActivityStatus)
  status?: ActivityStatus;

  @ApiPropertyOptional({
    enum: TaskEnjoymentLevel,
    example: TaskEnjoymentLevel.LOVE_IT,
    description: 'Love it, Enjoy it, Neutral, or Reluctant.',
  })
  @IsOptional()
  @IsEnum(TaskEnjoymentLevel)
  enjoyment?: TaskEnjoymentLevel;

  @ApiPropertyOptional({
    enum: ChildMood,
    example: ChildMood.HAPPY,
    description: 'Excited, Happy, Neutral, Tired, or Resistant.',
  })
  @IsOptional()
  @IsEnum(ChildMood)
  childMood?: ChildMood;

  @ApiPropertyOptional({
    enum: TaskCompletionRate,
    example: TaskCompletionRate.FULL_PLATE,
    description: 'Full plate, Half plate, or Untouched.',
  })
  @IsOptional()
  @IsEnum(TaskCompletionRate)
  completionRate?: TaskCompletionRate;

  @ApiPropertyOptional({
    example: 'She enjoyed the activity and followed the steps well.',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Optional image for this schedule feedback.',
  })
  @Allow()
  image?: unknown;
}
