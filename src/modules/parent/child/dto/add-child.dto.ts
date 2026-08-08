import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, HealthCondition } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class AddChildDto {
  @ApiProperty({ example: 'Eve Ahmed', description: "Child's given name" })
  @IsString()
  @IsNotEmpty()
  name: string;

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
    example: true,
    description: 'Flag indicating if the child has any food allergies',
  })
  @IsOptional()
  hasAllergy?: boolean;

  @ApiPropertyOptional({
    enum: HealthCondition,
    isArray: true,
    example: [HealthCondition.FOOD_ALLERGIES],
    description: "Child's health conditions",
  })
  @IsArray()
  @IsEnum(HealthCondition, { each: true })
  @IsOptional()
  healthConditions?: HealthCondition[];
}
