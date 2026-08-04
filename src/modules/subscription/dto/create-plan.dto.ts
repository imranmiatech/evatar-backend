import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { SubscriptionInterval } from '@prisma/client';

export class CreateSubscriptionPlanDto {
  @ApiProperty({ example: '2 child Family Membership', description: 'Name of the subscription plan' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 2, description: 'Maximum number of children covered' })
  @IsInt()
  @Min(1)
  maxChildren: number;

  @ApiProperty({ example: 60.0, description: 'Monthly or Annual price' })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 'AED', default: 'AED' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ enum: SubscriptionInterval, default: SubscriptionInterval.MONTHLY })
  @IsEnum(SubscriptionInterval)
  @IsOptional()
  interval?: SubscriptionInterval;

  @ApiPropertyOptional({ example: 'Save AUD 19 by choosing annual billing.' })
  @IsString()
  @IsOptional()
  savingsText?: string;

  @ApiProperty({
    example: [
      'Manage 2 child maximum at a time',
      'Customized daily routines for every child',
      'Nanny insights grounded in real-life experiences',
      'Unique bedtime stories crafted from their daily adventures',
    ],
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  features: string[];
}
