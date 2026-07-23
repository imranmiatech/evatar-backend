import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class VerifySignupOtpDto {
  @ApiPropertyOptional({
    description: 'User email address',
    example: 'parent@example.com',
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

  @ApiProperty({
    description: 'OTP code received via email or SMS',
    example: '1234',
  })
  @IsString()
  @IsNotEmpty()
  otpCode!: string;
}
