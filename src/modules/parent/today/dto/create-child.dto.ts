import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateChildDto {
  @ApiProperty({ example: 'Eve' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: '2021-04-15' })
  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @ApiPropertyOptional({ example: '42.7 lb' })
  @IsString()
  @IsOptional()
  weight?: string;

  @ApiPropertyOptional({ enum: ['BOY', 'GIRL', 'OTHER'] })
  @IsIn(['BOY', 'GIRL', 'OTHER'])
  @IsOptional()
  gender?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/eve.png' })
  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @ApiPropertyOptional({ example: ['peanuts', 'shellfish'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allergies?: string[];

  @ApiPropertyOptional({ example: 'No refined sugar after dinner.' })
  @IsString()
  @IsOptional()
  dietaryNotes?: string;

  @ApiPropertyOptional({ example: 'Mild pollen sensitivity.' })
  @IsString()
  @IsOptional()
  medicalNotes?: string;

  @ApiPropertyOptional({ example: 'Curious, gentle, loves pretend play.' })
  @IsString()
  @IsOptional()
  personality?: string;

  @ApiPropertyOptional({ example: 'Bath, pajamas, story, lights dim.' })
  @IsString()
  @IsOptional()
  sleepRoutine?: string;

  @ApiPropertyOptional({ example: ['blocks', 'forest stories', 'blueberries'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  favoriteThings?: string[];
}
