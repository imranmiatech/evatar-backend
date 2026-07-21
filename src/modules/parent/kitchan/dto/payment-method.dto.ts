import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { PAYMENT_METHOD_TYPES } from '../constants/kitchan.constants';

export class CreatePaymentMethodDto {
  @ApiProperty({ enum: PAYMENT_METHOD_TYPES })
  @IsIn(PAYMENT_METHOD_TYPES)
  type!: string;

  @ApiProperty({ example: 'Mastercard 4421' })
  @IsString()
  label!: string;

  @ApiPropertyOptional({ example: 'Mastercard' })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiPropertyOptional({ example: '4421' })
  @IsString()
  @IsOptional()
  last4?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @IsOptional()
  expiryMonth?: number;

  @ApiPropertyOptional({ example: 2029 })
  @IsInt()
  @IsOptional()
  expiryYear?: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

