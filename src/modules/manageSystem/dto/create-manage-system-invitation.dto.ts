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
import { ManageSystemPermissionsDto } from './manage-system-permissions.dto';

const optionalString = ({ value }: { value: unknown }) => {
  if (value === false || value === null || value === undefined) return undefined;
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'false') return undefined;
  return trimmed;
};

const uppercaseEnumString = ({ value }: { value: unknown }) => {
  const str = optionalString({ value });
  if (typeof str === 'string') return str.toUpperCase();
  return str;
};

export class CreateManageSystemInvitationDto extends ManageSystemPermissionsDto {
  @ApiProperty({
    enum: CaregiverAccessRole,
    example: CaregiverAccessRole.NANNY,
  })
  @IsEnum(CaregiverAccessRole)
  role!: CaregiverAccessRole;

  @ApiPropertyOptional({
    enum: CaregiverRelationship,
    example: CaregiverRelationship.FATHER,
    description: 'Sub-role for Parent (FATHER, MOTHER) or Family Member (GRANDMOTHER, GUARDIAN, GODPARENT, GRANDFATHER, UNCLE, SIBLING, AUNT, OTHER)',
  })
  @Transform(uppercaseEnumString)
  @IsOptional()
  @ValidateIf(
    (dto) =>
      (dto.role === CaregiverAccessRole.FAMILY_MEMBER ||
      dto.role === CaregiverAccessRole.PARENT) &&
      dto.relationship,
  )
  @IsEnum(CaregiverRelationship)
  relationship?: CaregiverRelationship;

  @ApiPropertyOptional({
    example: 'Martha Stewart',
    description: 'Optional display name when inviting a family member.',
  })
  @Transform(optionalString)
  @ValidateIf((dto) => dto.role === CaregiverAccessRole.FAMILY_MEMBER && dto.invitedName)
  @IsString()
  @IsOptional()
  invitedName?: string;

  @ApiPropertyOptional({ example: 'nanny@example.com' })
  @Transform(optionalString)
  @IsEmail()
  @IsOptional()
  invitedEmail?: string;

  @ApiPropertyOptional({ example: '+15550000000' })
  @Transform(optionalString)
  @IsString()
  @IsOptional()
  invitedPhone?: string;

  @ApiPropertyOptional({ example: 'user-uuid-1234' })
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
