import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateMembershipCheckoutSessionDto {
  @ApiProperty({ description: 'ID of the membership plan to purchase' })
  @IsString()
  @IsNotEmpty()
  planId: string;

  @ApiPropertyOptional({
    description: 'Optional redirect URL after successful Stripe Checkout payment',
  })
  @IsString()
  @IsOptional()
  successUrl?: string;

  @ApiPropertyOptional({
    description: 'Optional redirect URL after cancelled Stripe Checkout payment',
  })
  @IsString()
  @IsOptional()
  cancelUrl?: string;
}
