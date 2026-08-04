import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { plainToInstance, Transform, Type } from 'class-transformer';
import { ActivityType, EnergyLevel, ActivityLocation, ContentStatus } from '@prisma/client';

class ActivityBenefitDto {
  @ApiProperty({ example: 'Cognitive' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Enhances cognitive development through problem-solving.' })
  @IsString()
  description: string;

  @ApiPropertyOptional({ example: 'https://example.com/icon.jpg' })
  @IsOptional()
  @IsString()
  iconUrl?: string;
}

class ActivityStepDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  stepNumber: number;

  @ApiProperty({ example: 'Set up the sensory bin with sand and hidden toys.' })
  @IsString()
  description: string;
}

class ActivityProgressionDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  level: number;

  @ApiProperty({ example: 'For younger toddlers, start with larger, easy-to-find objects.' })
  @IsString()
  description: string;
}

export class CreateActivityDto {
  @ApiProperty({ example: 'Color Hunt Discovery' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'Cover image file upload' })
  @IsOptional()
  coverImage?: any;

  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'Video file upload' })
  @IsOptional()
  video?: any;

  @ApiProperty({ enum: ActivityType, example: ActivityType.CREATIVE_PLAY })
  @IsEnum(ActivityType)
  activityType: ActivityType;

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @IsNumber()
  minAgeMonths?: number;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsNumber()
  maxAgeMonths?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsNumber()
  durationMin?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsNumber()
  durationMax?: number;

  @ApiPropertyOptional({ enum: EnergyLevel, example: EnergyLevel.LOW })
  @IsOptional()
  @IsEnum(EnergyLevel)
  energyLevel?: EnergyLevel;

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
      return value.split(',').map(s => s.trim());
    }
    return Array.isArray(value) ? value : [value];
  })
  @ApiPropertyOptional({ enum: ActivityLocation, isArray: true, example: [ActivityLocation.INDOOR, ActivityLocation.OUTDOOR] })
  @IsOptional()
  @IsArray()
  @IsEnum(ActivityLocation, { each: true })
  location?: ActivityLocation[];

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
      return value.split(',').map(s => s.trim());
    }
    return Array.isArray(value) ? value : [value];
  })
  @ApiPropertyOptional({ example: ['Tray with sand or salt', 'Spray bottle with water', 'Hidden objects'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  materials?: string[];

  @ApiPropertyOptional({ example: 'Children co-create a shared imaginary world where ideas are visible, named, and valued by the group.' })
  @IsOptional()
  @IsString()
  connectionMoment?: string;

  @ApiPropertyOptional({ example: 'Encourages curiosity and fine motor skill development.' })
  @IsOptional()
  @IsString()
  whyThisActivity?: string;

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
      return value.split(',').map(s => s.trim());
    }
    return Array.isArray(value) ? value : [value];
  })
  @ApiPropertyOptional({ example: ['What color is this?', 'Can you find something red?'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  caregiverPrompts?: string[];

  @ApiPropertyOptional({ example: 'Ensure all small objects are safe for children and supervise to avoid choking hazards.' })
  @IsOptional()
  @IsString()
  safetyNotes?: string;

  @ApiPropertyOptional({ enum: ContentStatus, example: ContentStatus.PUBLISHED })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;



  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map((item: any) => plainToInstance(ActivityBenefitDto, item)) : parsed;
      } catch { return value; }
    }
    if (Array.isArray(value)) {
      return value.map((item: any) => plainToInstance(ActivityBenefitDto, item));
    }
    return value;
  })
  @ApiPropertyOptional({ type: 'string', description: 'JSON stringified array of benefits', example: `[
  { "title": "Social", "description": "Collaboration, shared creation" },
  { "title": "Cognitive", "description": "Understanding object permanence" },
  { "title": "Emotional", "description": "Self-expression through play" },
  { "title": "Physical", "description": "Fine motor control development" }
]` })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActivityBenefitDto)
  benefits?: ActivityBenefitDto[];

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map((item: any) => plainToInstance(ActivityStepDto, item)) : parsed;
      } catch { return value; }
    }
    if (Array.isArray(value)) {
      return value.map((item: any) => plainToInstance(ActivityStepDto, item));
    }
    return value;
  })
  @ApiPropertyOptional({ type: 'string', description: 'JSON stringified array of steps', example: `[
  { "stepNumber": 1, "description": "Prepare the play area by laying down a protective mat." },
  { "stepNumber": 2, "description": "Introduce the materials to the child one by one." }
]` })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActivityStepDto)
  steps?: ActivityStepDto[];

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map((item: any) => plainToInstance(ActivityProgressionDto, item)) : parsed;
      } catch { return value; }
    }
    if (Array.isArray(value)) {
      return value.map((item: any) => plainToInstance(ActivityProgressionDto, item));
    }
    return value;
  })
  @ApiPropertyOptional({ type: 'string', description: 'JSON stringified array of progressions', example: `[
  { "level": 1, "description": "Simple exploration of textures without tools." },
  { "level": 2, "description": "Introduce tools like scoops or brushes for more complex interaction." }
]` })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActivityProgressionDto)
  progressions?: ActivityProgressionDto[];
}
