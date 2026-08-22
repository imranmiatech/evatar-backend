import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export enum UnifiedPaymentType {
  MEMBERSHIP = 'MEMBERSHIP',
  NANNY_TIP = 'NANNY_TIP',
  PARTNER_PRODUCT = 'PARTNER_PRODUCT',
  GROCERY_ORDER = 'GROCERY_ORDER',
}

export class UnifiedPaymentCheckoutDto {
  @ApiProperty({
    enum: UnifiedPaymentType,
    example: UnifiedPaymentType.MEMBERSHIP,
    description:
      'Use MEMBERSHIP for subscription payments, NANNY_TIP for nanny appreciation, PARTNER_PRODUCT for partner store products, or GROCERY_ORDER for grocery checkout.',
  })
  @IsEnum(UnifiedPaymentType)
  paymentType!: UnifiedPaymentType;

  @ApiPropertyOptional({
    example: 'saved-payment-method-id',
    description:
      'Optional saved payer payment method ID. If omitted, the default saved payment method is used.',
  })
  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @ApiPropertyOptional({
    example: 'membership-plan-id',
    description: 'Required when paymentType is MEMBERSHIP.',
  })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({
    example: 'http://localhost:5000/signup-ui?session_id={CHECKOUT_SESSION_ID}&plan_id=abc',
    description:
      'Optional hosted checkout success URL override for membership payments.',
  })
  @IsOptional()
  @IsString()
  successUrl?: string;

  @ApiPropertyOptional({
    example: 'http://localhost:5000/signup-ui?canceled=true',
    description:
      'Optional hosted checkout cancel URL override for membership payments.',
  })
  @IsOptional()
  @IsString()
  cancelUrl?: string;

  @ApiPropertyOptional({
    example: 'stripe-payment-intent-id',
    description:
      'Optional Stripe PaymentIntent ID for membership completion flows if already created elsewhere.',
  })
  @IsOptional()
  @IsString()
  paymentIntentId?: string;

  @ApiPropertyOptional({
    example: 'nanny-user-id',
    description: 'Required when paymentType is NANNY_TIP.',
  })
  @IsOptional()
  @IsString()
  nannyUserId?: string;

  @ApiPropertyOptional({
    example: 'child-id',
    description: 'Optional child ID associated with the nanny tip.',
  })
  @IsOptional()
  @IsString()
  childId?: string;

  @ApiPropertyOptional({
    example: 30,
    description:
      'Required for NANNY_TIP and PARTNER_PRODUCT. Membership amount comes from the selected plan.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  amount?: number;

  @ApiPropertyOptional({
    example: 'AED',
    description:
      'Optional currency override for NANNY_TIP and PARTNER_PRODUCT. Defaults to AED.',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    example: 'Thank you for this week!',
    description: 'Optional note for nanny tip payments.',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    example: 'partner-product-id',
    description: 'Required when paymentType is PARTNER_PRODUCT.',
  })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({
    example: 'grocery-order-id',
    description: 'Required when paymentType is GROCERY_ORDER.',
  })
  @IsOptional()
  @IsString()
  groceryOrderId?: string;
}
