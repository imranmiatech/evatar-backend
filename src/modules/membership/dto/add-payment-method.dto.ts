import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class AddMembershipPaymentMethodDto {
  @ApiProperty({
    example: 'Mastercard',
    description: 'Card brand (e.g. Mastercard, Visa)',
  })
  @IsString()
  @IsNotEmpty()
  brand: string;

  @ApiProperty({ example: '4421', description: 'Last 4 digits of card' })
  @IsString()
  @IsNotEmpty()
  last4: string;

  @ApiProperty({ example: 12, description: 'Expiry month (1-12)' })
  @IsInt()
  @Min(1)
  @Max(12)
  expMonth: number;

  @ApiProperty({ example: 2028, description: 'Expiry year (e.g. 2028)' })
  @IsInt()
  @Min(2024)
  expYear: number;

  @ApiPropertyOptional({
    example: 'John Doe',
    description: 'Cardholder name as on card',
  })
  @IsString()
  @IsOptional()
  cardholderName?: string;

  @ApiPropertyOptional({ example: true, default: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
