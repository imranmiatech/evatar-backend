import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { RewardRuleStatus, RewardRuleUserType } from '@prisma/client';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum RewardRuleActivityKey {
  COMPLETE_DAILY_FLOW = 'COMPLETE_DAILY_FLOW',
  COMPLETE_CARE_MODULE = 'COMPLETE_CARE_MODULE',
  RECORD_BEDTIME_STORY = 'RECORD_BEDTIME_STORY',
  WEEKLY_CARE_COMPLETION = 'WEEKLY_CARE_COMPLETION',
  PARENT_APPRECIATION = 'PARENT_APPRECIATION',
  DAILY_CARE_LOG = 'DAILY_CARE_LOG',
  CUSTOM = 'CUSTOM',
}

export class CreateRewardRuleDto {
  @ApiProperty({
    enum: RewardRuleActivityKey,
    example: RewardRuleActivityKey.COMPLETE_CARE_MODULE,
  })
  @IsEnum(RewardRuleActivityKey)
  activityKey!: RewardRuleActivityKey;

  @ApiProperty({ example: 'Complete Care Module' })
  @IsString()
  activityName!: string;

  @ApiProperty({
    enum: RewardRuleUserType,
    isArray: true,
    example: [RewardRuleUserType.PARENT, RewardRuleUserType.NANNY],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(RewardRuleUserType, { each: true })
  eligibleUserTypes!: RewardRuleUserType[];

  @ApiProperty({ example: 50, minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(100000)
  alureiValue!: number;

  @ApiPropertyOptional({ example: 10, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  weeklyLimit?: number;

  @ApiPropertyOptional({
    enum: RewardRuleStatus,
    example: RewardRuleStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(RewardRuleStatus)
  status?: RewardRuleStatus;

  @ApiPropertyOptional({
    example: 'Awarded when a user completes a care module quiz.',
  })
  @IsOptional()
  @IsString()
  internalNotes?: string;
}

export class UpdateRewardRuleDto extends PartialType(CreateRewardRuleDto) {}
