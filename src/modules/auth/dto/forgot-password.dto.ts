import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @ApiPropertyOptional({
    description: 'User email address',
    example: 'john@example.com',
  })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: 'User phone number with country code',
    example: '+8801943747529',
  })
  @IsString()
  @IsOptional()
  phoneNumber?: string;
}
