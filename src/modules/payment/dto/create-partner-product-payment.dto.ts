import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePartnerProductPaymentDto {
  @ApiProperty({ example: 'partner-product-id' })
  @IsString()
  productId!: string;

  @ApiProperty({ example: 59.99 })
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiPropertyOptional({ example: 'AED' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({
    example: 'payment-method-123',
    description: 'Optional saved payer payment method ID to use for this product purchase.',
  })
  @IsString()
  @IsOptional()
  paymentMethodId?: string;
}
