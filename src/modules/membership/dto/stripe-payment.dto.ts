import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateMembershipStripePaymentIntentDto {
  @ApiProperty({ description: 'ID of the membership plan to purchase' })
  @IsString()
  @IsNotEmpty()
  planId: string;
}

export class MembershipStripeWebhookDto {
  // Webhook body handled as raw Buffer/json
}
