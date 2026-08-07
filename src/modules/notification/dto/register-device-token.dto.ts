import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDeviceTokenDto {
  @ApiProperty({ description: 'FCM Device token from mobile client', example: 'fcm_token_xyz123...' })
  @IsNotEmpty()
  @IsString()
  fcmToken: string;

  @ApiPropertyOptional({ description: 'Device OS platform e.g. ANDROID, IOS, WEB', example: 'ANDROID' })
  @IsOptional()
  @IsString()
  deviceType?: string;
}
