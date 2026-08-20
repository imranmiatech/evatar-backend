import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class SimulateMembershipPaymentFailureDto {
  @ApiPropertyOptional({
    example: 99.0,
    description: 'Failed transaction amount',
  })
  @IsNumber()
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({
    example: 'Insufficient funds on default Mastercard 4421',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
