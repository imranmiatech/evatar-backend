import { IsNotEmpty, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExtendTrialDto {
  @ApiProperty({ description: 'Number of days to extend trial period by', example: 7 })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  days: number;
}
