import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AdminMessageChannel {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  BOTH = 'BOTH',
}

export class SendUserMessageDto {
  @ApiPropertyOptional({ description: 'Message subject line' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({ description: 'Content of the message' })
  @IsNotEmpty()
  @IsString()
  message: string;

  @ApiPropertyOptional({ enum: AdminMessageChannel, default: AdminMessageChannel.BOTH })
  @IsOptional()
  @IsEnum(AdminMessageChannel)
  channel?: AdminMessageChannel;
}
