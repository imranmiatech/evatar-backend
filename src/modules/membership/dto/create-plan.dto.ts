import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionInterval } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateMembershipPlanDto {
  @ApiProperty({
    example: '2 child Family Membership',
    description: 'Name of the membership plan',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 2,
    description: 'Maximum number of children covered',
  })
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

  @ApiPropertyOptional({
    example: 'Flexible monthly billing. Cancel anytime.',
    description: 'Short supporting description shown on the plan card',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    example: 'Save 2 Months',
    description: 'Optional compact badge text shown on the plan card',
  })
  @IsString()
  @IsOptional()
  badgeText?: string;

  @ApiPropertyOptional({
    example: 10,
    description: 'Recurring amount charged for each child above the included limit',
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  additionalChildPrice?: number;

  @ApiPropertyOptional({
    example: 'USD',
    description: 'Currency used for the additional child charge',
  })
  @IsString()
  @IsOptional()
  additionalChildCurrency?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Lower numbers are shown first in the plan list',
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @ApiProperty({
    enum: SubscriptionInterval,
    default: SubscriptionInterval.MONTHLY,
  })
  @IsEnum(SubscriptionInterval)
  @IsOptional()
  interval?: SubscriptionInterval;

  @ApiPropertyOptional({
    example: 'Save AED 798 by choosing annual billing.',
  })
  @IsString()
  @IsOptional()
  savingsText?: string;

  @ApiProperty({
    isArray: true,
    example: [
      'Manage 2 child maximum at a time',
      'Customized daily routines for every child',
      'Nanny insights grounded in real-life experiences',
    ],
  })
  @IsArray()
  @IsString({ each: true })
  features: string[];
}
