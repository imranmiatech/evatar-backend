import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
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

  @ApiProperty({
    description: 'OTP code received via email or SMS',
    example: '1234',
  })
  @IsString()
  @IsNotEmpty()
  otpCode: string;

  @ApiProperty({
    description: 'New password for the user',
    example: 'NewPassword123!',
  })
  @IsString()
  @MinLength(6)
  newPassword: string;
}
