import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateStripePaymentIntentDto {
  @ApiProperty({ description: 'ID of the subscription plan to purchase' })
  @IsString()
  @IsNotEmpty()
  planId: string;
}

export class StripeWebhookDto {
  // Webhook body handled as raw Buffer/json
}
