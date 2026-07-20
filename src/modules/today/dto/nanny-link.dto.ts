import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateNannyLinkDto {
  @ApiProperty({ example: 'nanny-user-id' })
  @IsString()
  @IsNotEmpty()
  nannyUserId: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  canViewStory?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  canUpdateProof?: boolean;
}

export class CompleteProofDto {
  @ApiProperty({ example: 'activity-proof/user-id/activity-id.jpg' })
  @IsString()
  @IsNotEmpty()
  storageKey: string;

  @ApiProperty({ example: 'https://cdn.example.com/proof.jpg' })
  @IsString()
  @IsNotEmpty()
  mediaUrl: string;

  @ApiPropertyOptional({ example: 'image/jpeg' })
  @IsString()
  @IsOptional()
  mimeType?: string;
}
