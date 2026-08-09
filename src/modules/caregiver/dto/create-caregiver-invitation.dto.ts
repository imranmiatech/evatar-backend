import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  CaregiverAccessRole,
  CaregiverInviteChannel,
  CaregiverRelationship,
} from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  ValidateIf,
} from 'class-validator';
import { CaregiverPermissionsDto } from './caregiver-permissions.dto';

const optionalString = ({ value }: { value: unknown }) => {
  if (value === false || value === null || value === undefined) return undefined;
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'false') return undefined;
  return trimmed;
};

export class CreateCaregiverInvitationDto extends CaregiverPermissionsDto {
  @ApiProperty({
    enum: CaregiverAccessRole,
    example: CaregiverAccessRole.NANNY,
  })
  @IsEnum(CaregiverAccessRole)
  role!: CaregiverAccessRole;

  @ApiPropertyOptional({
    enum: CaregiverRelationship,
    example: CaregiverRelationship.GRANDMOTHER,
  })
  @ValidateIf((dto) => dto.role === CaregiverAccessRole.FAMILY_MEMBER)
  @IsEnum(CaregiverRelationship)
  relationship?: CaregiverRelationship;

  @ApiPropertyOptional({
    example: 'Martha Stewart',
    description: 'Required only when inviting a family member.',
  })
  @Transform(optionalString)
  @ValidateIf((dto) => dto.role === CaregiverAccessRole.FAMILY_MEMBER)
  @IsString()
  @IsNotEmpty()
  invitedName?: string;

  @ApiPropertyOptional({ example: 'caregiver@example.com' })
  @Transform(optionalString)
  @IsEmail()
  @IsOptional()
  invitedEmail?: string;

  @ApiPropertyOptional({ example: '+15550000000' })
  @Transform(optionalString)
  @IsPhoneNumber()
  @IsOptional()
  invitedPhone?: string;

  @ApiPropertyOptional({ example: 'cmrwwed7q0000aalr1ka7hzth' })
  @Transform(optionalString)
  @IsString()
  @IsOptional()
  invitedUserId?: string;

  @ApiPropertyOptional({
    enum: CaregiverInviteChannel,
    example: CaregiverInviteChannel.EMAIL,
  })
  @IsEnum(CaregiverInviteChannel)
  @IsOptional()
  inviteChannel?: CaregiverInviteChannel;
}
