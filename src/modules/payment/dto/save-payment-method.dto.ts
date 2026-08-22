import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsCreditCard,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class SavePaymentMethodDto {
  @ApiPropertyOptional({
    example: 'Mastercard',
    description:
      'Card brand (e.g. Mastercard, Visa). Optional if card number is provided.',
  })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiPropertyOptional({
    example: '4654 6575 4356 4444',
    description: 'Full card number for the payment-method test form.',
  })
  @IsString()
  @IsCreditCard()
  @IsOptional()
  cardNumber?: string;

  @ApiPropertyOptional({
    example: '4444',
    description: 'Last 4 digits of card. Used if full card number is not supplied.',
  })
  @IsString()
  @Length(4, 4)
  @IsOptional()
  last4?: string;

  @ApiProperty({ example: 12, description: 'Expiry month (1-12)' })
  @IsInt()
  @Min(1)
  @Max(12)
  expMonth!: number;

  @ApiProperty({ example: 2028, description: 'Expiry year (e.g. 2028)' })
  @IsInt()
  @Min(2024)
  expYear!: number;

  @ApiPropertyOptional({
    example: 'John Doe',
    description: 'Cardholder name as on card',
  })
  @IsString()
  @IsOptional()
  cardholderName?: string;

  @ApiPropertyOptional({
    example: '123',
    description: 'CVV/CVC for the test payment form. It is validated but never stored.',
  })
  @IsString()
  @Length(3, 4)
  @IsOptional()
  cvv?: string;

  @ApiPropertyOptional({ example: true, default: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
