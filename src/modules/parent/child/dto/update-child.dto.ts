import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, HealthCondition } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateChildDto {
  @ApiPropertyOptional({ example: 'Eve Ahmed', description: "Child's given name" })
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

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.png',
    description: "Child's avatar URL",
  })
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
  @IsOptional()
  healthConditions?: HealthCondition[];

  @ApiPropertyOptional({
    example: 'Allergic to peanuts.',
    description: 'Any additional notes about the child',
  })
  @IsString()
  @IsOptional()
  additionalNotes?: string;
}
