import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SubscribeMembershipPlanDto {
  @ApiProperty({ description: 'ID of the membership plan to subscribe to' })
  @IsString()
  @IsNotEmpty()
  planId: string;

  @ApiPropertyOptional({
    description:
      'Optional Stripe PaymentIntent ID after client-side payment confirmation',
  })
  @IsString()
  @IsOptional()
  paymentIntentId?: string;

  @ApiPropertyOptional({
    description: 'Optional ID of a saved payment method to charge',
  })
  @IsString()
  @IsOptional()
  paymentMethodId?: string;

  @ApiPropertyOptional({
    description:
      'Optional card brand if providing card details directly during checkout',
  })
  @IsString()
  @IsOptional()
  cardBrand?: string;

  @ApiPropertyOptional({
    description:
      'Optional last 4 digits if providing card details directly during checkout',
  })
  @IsString()
  @IsOptional()
  cardLast4?: string;
}
