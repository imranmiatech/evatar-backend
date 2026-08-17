import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
