import {
  ApiHideProperty,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { Gender, HealthCondition, DayOfWeek } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

function parseJsonString(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function parseMultipartArray(value: unknown) {
  const parsed = parseJsonString(value);

  if (parsed === undefined || Array.isArray(parsed)) {
    return parsed;
  }

  if (typeof parsed === 'string') {
    return [parsed];
  }

  return parsed;
}

function parseMultipartBoolean(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return value;
}

export class SchoolScheduleDto {
  @ApiProperty({
    enum: DayOfWeek,
    isArray: true,
    example: [DayOfWeek.MON, DayOfWeek.TUE],
  })
  @IsArray()
  @IsEnum(DayOfWeek, { each: true })
  days: DayOfWeek[];

  @ApiProperty({ example: '08:30' })
  @IsString()
  startTime: string;

  @ApiProperty({ example: '14:30' })
  @IsString()
  endTime: string;
}

export class NapWindowDto {
  @ApiProperty({ example: '13:00' })
  @IsString()
  startTime: string;

  @ApiProperty({ example: '15:00' })
  @IsString()
  endTime: string;
}

function parseSchoolSchedule(value: unknown) {
  const parsed = parseJsonString(value);

  if (
    parsed === undefined ||
    parsed === null ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed)
  ) {
    return parsed;
  }

  return Object.assign(new SchoolScheduleDto(), parsed);
}

function parseNapWindows(value: unknown) {
  const parsed = parseMultipartArray(value);

  if (!Array.isArray(parsed)) {
    return parsed;
  }

  return parsed.map((nap) =>
    nap && typeof nap === 'object'
      ? Object.assign(new NapWindowDto(), nap)
      : nap,
  );
}

export class UpdateChildDto {
  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description:
      'Optional child profile image file. Use this field with multipart/form-data.',
  })
  @IsOptional()
  profilePicture?: Express.Multer.File;

  @ApiPropertyOptional({
    example: 'Eve Ahmed',
    description: "Child's given name",
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    enum: Gender,
    example: Gender.GIRL,
    description: "Child's gender",
  })
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @ApiPropertyOptional({
    example: '12 kg',
    description: "Child's weight (e.g. '0 to 6 kg')",
  })
  @IsString()
  @IsOptional()
  weight?: string;

  @ApiPropertyOptional({
    example: '2022-05-16',
    description: "Child's birth date (ISO 8601 format)",
  })
  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @ApiHideProperty()
  @IsString()
  @IsOptional()
  avatar?: string;

  @ApiPropertyOptional({
    example: '07:00',
    description: "Child's typical wake up time (HH:mm)",
  })
  @IsString()
  @IsOptional()
  wakeUpTime?: string;

  @ApiPropertyOptional({
    example: '20:00',
    description: "Child's typical bed time (HH:mm)",
  })
  @IsString()
  @IsOptional()
  bedTime?: string;

  @ApiPropertyOptional({
    enum: HealthCondition,
    isArray: true,
    example: [HealthCondition.NONE],
    description: "Child's health conditions",
  })
  @IsArray()
  @IsEnum(HealthCondition, { each: true })
  @Transform(({ value }) => parseMultipartArray(value))
  @IsOptional()
  healthConditions?: HealthCondition[];

  @ApiPropertyOptional({
    example: true,
    description: 'Flag indicating if the child has any food allergies',
  })
  @IsOptional()
  @Transform(({ obj, key, value }) =>
    parseMultipartBoolean(obj?.[key] ?? value),
  )
  @IsBoolean()
  hasAllergy?: boolean;

  @ApiPropertyOptional({
    example: 'Allergic to peanuts.',
    description: 'Any additional notes about the child',
  })
  @IsString()
  @IsOptional()
  additionalNotes?: string;

  @ApiPropertyOptional({ example: 'Pasta, banana, yogurt' })
  @IsString()
  @IsOptional()
  favfood?: string;

  @ApiPropertyOptional({ example: 'Drawing, outdoor play, story time' })
  @IsString()
  @IsOptional()
  favActivites?: string;

  @ApiPropertyOptional({ example: 'Bedtime routine and picky eating' })
  @IsString()
  @IsOptional()
  currentChallenges?: string;

  @ApiPropertyOptional({ example: 'Needs gentle reminders during transitions' })
  @IsString()
  @IsOptional()
  extraNote?: string;

  @ApiPropertyOptional({ type: SchoolScheduleDto })
  @ValidateNested()
  @Transform(({ value }) => parseSchoolSchedule(value))
  @Type(() => SchoolScheduleDto)
  @IsOptional()
  schoolSchedule?: SchoolScheduleDto;

  @ApiPropertyOptional({ type: [NapWindowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Transform(({ value }) => parseNapWindows(value))
  @Type(() => NapWindowDto)
  @IsOptional()
  naps?: NapWindowDto[];
}
