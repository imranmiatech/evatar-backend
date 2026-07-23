import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateNannyInvitationDto {
  @ApiProperty({
    example: 'nanny@example.com',
    description: 'Existing nanny account email address',
  })
  @IsEmail()
  nannyEmail!: string;

  @ApiPropertyOptional({
    example: 'cmrwwed7q0000aalr1ka7hzth',
    description: 'Existing child id. If missing, childName will be used.',
  })
  @IsString()
  @IsOptional()
  childId?: string;

  @ApiPropertyOptional({
    example: 'Eve',
    description: 'Child name used to create a test child when childId is absent.',
  })
  @IsString()
  @IsOptional()
  childName?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  canViewStory?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  canUpdateProof?: boolean;
}
