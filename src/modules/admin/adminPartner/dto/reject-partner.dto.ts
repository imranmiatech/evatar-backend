import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RejectPartnerDto {
  @ApiProperty({
    example: 'Business documents could not be verified.',
    description: 'Reason shown to the partner when their request is rejected.',
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
