import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateMembershipStripePaymentIntentDto {
  @ApiProperty({ description: 'ID of the membership plan to purchase' })
  @IsString()
  @IsNotEmpty()
  planId: string;

  @ApiPropertyOptional({
    description: 'Optional saved payer payment method ID to use for this membership purchase',
  })
  @IsString()
  @IsOptional()
  paymentMethodId?: string;
}

export class MembershipStripeWebhookDto {
  // Webhook body handled as raw Buffer/json
}
