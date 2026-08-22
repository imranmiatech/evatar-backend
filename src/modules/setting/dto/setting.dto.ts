import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'currentPassword123' })
  @IsNotEmpty()
  @IsString()
  currentPassword: string;

  @ApiProperty({ example: 'newPassword123!' })
  @IsNotEmpty()
  @IsString()
  @MinLength(4, { message: 'Password must be at least 4 characters long' })
  newPassword: string;
}

export class DeleteAccountDto {
  @ApiProperty({ example: 'Too expensive' })
  @IsNotEmpty()
  @IsString()
  reason: string;

  @ApiProperty({ example: 'I found a cheaper alternative.', required: false })
  @IsString()
  details?: string;
}

export class SavePayoutMethodDto {
  @ApiPropertyOptional({ example: 'Primary payout card' })
  @IsString()
  @IsOptional()
  label?: string;

  @ApiPropertyOptional({
    example: 'CARD',
    description: 'Supported values: CARD, BANK_ACCOUNT',
  })
  @IsString()
  @IsIn(['CARD', 'BANK_ACCOUNT'])
  @IsOptional()
  methodType?: string;

  @ApiPropertyOptional({ example: 'Mastercard' })
  @IsString()
  @IsOptional()
  providerName?: string;

  @ApiPropertyOptional({
    example: 'acct_1QwErTyUiOp12345',
    description:
      'Stripe connected account ID created from Stripe onboarding for destination charges',
  })
  @IsString()
  @IsOptional()
  stripeConnectedAccountId?: string;

  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsString()
  @IsOptional()
  accountHolderName?: string;

  @ApiPropertyOptional({ example: '4654 6575 4356 4444' })
  @IsString()
  @IsOptional()
  cardNumber?: string;

  @ApiPropertyOptional({ example: '4421' })
  @IsString()
  @Length(4, 4)
  @IsOptional()
  cardLast4?: string;

  @ApiPropertyOptional({ example: 12 })
  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  expiryMonth?: number;

  @ApiPropertyOptional({ example: 2028 })
  @IsInt()
  @Min(2024)
  @IsOptional()
  expiryYear?: number;

  @ApiPropertyOptional({ example: 'AE070331234567890123456' })
  @IsString()
  @IsOptional()
  iban?: string;

  @ApiPropertyOptional({ example: '123456789012' })
  @IsString()
  @IsOptional()
  accountNumber?: string;

  @ApiPropertyOptional({ example: '110000000' })
  @IsString()
  @IsOptional()
  routingNumber?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class UpdateMembershipRoutingDto {
  @ApiProperty({ example: 'admin-user-id' })
  @IsString()
  @IsNotEmpty()
  targetUserId: string;

  @ApiPropertyOptional({ example: 'Primary admin receiver for membership subscriptions' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateStripeOnboardingLinkDto {
  @ApiPropertyOptional({
    example: 'http://localhost:5000/grocery-order-ui.html?partner_onboarding=done',
  })
  @IsString()
  @IsOptional()
  returnUrl?: string;

  @ApiPropertyOptional({
    example: 'http://localhost:5000/grocery-order-ui.html?partner_onboarding=refresh',
  })
  @IsString()
  @IsOptional()
  refreshUrl?: string;
}
