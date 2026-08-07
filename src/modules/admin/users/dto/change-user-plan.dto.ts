import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChangeUserPlanDto {
  @ApiPropertyOptional({ description: 'ID of the target subscription plan' })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({ description: 'Name of the target subscription plan (e.g. Starter, Family, Premium)' })
  @IsOptional()
  @IsString()
  planName?: string;
}
