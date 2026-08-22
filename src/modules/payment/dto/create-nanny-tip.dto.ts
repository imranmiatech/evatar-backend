import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateNannyTipDto {
  @ApiProperty({
    description: 'Nanny User ID receiving the tip',
    example: '67ac3bb5-7de1-4ba2-baa7-bdeba853bd5a',
  })
  @IsNotEmpty()
  @IsString()
  nannyUserId!: string;

  @ApiPropertyOptional({
    description: 'Optional Child ID linked to the nanny assignment',
    example: 'child-123',
  })
  @IsOptional()
  @IsString()
  childId?: string;

  @ApiProperty({
    description: 'Tip amount in AED (Min: 1 AED)',
    example: 30,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiPropertyOptional({
    description: 'Currency code (Default: AED)',
    example: 'AED',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Optional note or appreciation message',
    example: 'Thank you for taking great care of Eve this week!',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    description: 'Optional saved payer payment method ID to use for this tip',
    example: 'payment-method-123',
  })
  @IsOptional()
  @IsString()
  paymentMethodId?: string;
}
