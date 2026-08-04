import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CancellationReason } from '@prisma/client';

export class CancelFeedbackDto {
  @ApiProperty({
    enum: CancellationReason,
    example: CancellationReason.TOO_EXPENSIVE,
    description: 'Reason for cancellation: TOO_EXPENSIVE, NOT_USING_ENOUGH, SWITCHING_PROVIDERS, SOMETHING_ELSE',
  })
  @IsEnum(CancellationReason)
  @IsNotEmpty()
  reason: CancellationReason;

  @ApiPropertyOptional({ example: 'Service is great, but currently out of budget.', description: 'Detailed feedback' })
  @IsString()
  @IsOptional()
  detailNote?: string;
}
