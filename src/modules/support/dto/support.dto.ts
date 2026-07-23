import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTicketDto {
  @ApiProperty({ example: 'Payment issue' })
  @IsNotEmpty()
  @IsString()
  subject: string;

  @ApiProperty({ example: 'I was charged twice for my last booking.' })
  @IsNotEmpty()
  @IsString()
  message: string;
}

export class SendMessageDto {
  @ApiProperty({ example: 'What healthy breakfast can I prepare?', required: false })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({ example: 'https://cloudinary.com/voice.webm', required: false })
  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @ApiProperty({ example: 'audio/webm', required: false })
  @IsOptional()
  @IsString()
  attachmentType?: string;
}

export class UpdateTicketStatusDto {
  @ApiProperty({ example: 'REPLIED', enum: ['PENDING', 'REPLIED', 'RESOLVED'] })
  @IsNotEmpty()
  @IsEnum(['PENDING', 'REPLIED', 'RESOLVED'])
  status: 'PENDING' | 'REPLIED' | 'RESOLVED';
}
