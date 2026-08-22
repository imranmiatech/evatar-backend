import { ApiPropertyOptional } from '@nestjs/swagger';
import { CancellationReason } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CancelMembershipDto {
  @ApiPropertyOptional({
    enum: CancellationReason,
    example: CancellationReason.TOO_EXPENSIVE,
    description:
      'Optional cancellation reason. If provided, feedback is saved before membership is cancelled.',
  })
  @IsEnum(CancellationReason)
  @IsOptional()
  reason?: CancellationReason;

  @ApiPropertyOptional({
    example: 'Service is great, but currently out of budget.',
    description: 'Optional detailed cancellation note.',
  })
  @IsString()
  @IsOptional()
  detailNote?: string;
}
