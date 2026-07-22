import { ArrayMinSize, IsArray, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateConversationDto {
  @ApiProperty({
    example: ['clxparticipant1', 'clxparticipant2'],
    description:
      'Users to add to the chat. The logged-in user is added automatically.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  participantIds!: string[];

  @ApiProperty({ example: 'Eve care team', required: false })
  @IsOptional()
  @IsString()
  title?: string;
}

export class SendChatMessageDto {
  @ApiProperty({
    example: 'What healthy breakfast can I prepare for Eve tomorrow?',
    required: false,
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({
    example: 'https://res.cloudinary.com/.../image.png',
    required: false,
  })
  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @ApiProperty({ example: 'image', required: false })
  @IsOptional()
  @IsString()
  attachmentType?: string;
}
