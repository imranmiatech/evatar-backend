import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CaregiverAccessRole, CaregiverInviteChannel } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
} from 'class-validator';
import { ManageSystemPermissionsDto } from '../../caregiver/dto/manage-system-permissions.dto';

export class CreateManageSystemInvitationDto extends ManageSystemPermissionsDto {
  @ApiProperty({
    enum: CaregiverAccessRole,
    example: CaregiverAccessRole.NANNY,
    description: 'Caregiver role: NANNY, PARENT, FAMILY_MEMBER',
  })
  @IsEnum(CaregiverAccessRole)
  @IsNotEmpty()
  role: CaregiverAccessRole;

  @ApiPropertyOptional({
    example: 'Nanny',
    description: 'Relationship label (e.g. Nanny, Mother, Father, Grandmother)',
  })
  @IsOptional()
  @IsString()
  relationship?: string;

  @ApiPropertyOptional({
    enum: CaregiverInviteChannel,
    example: CaregiverInviteChannel.EMAIL,
  })
  @IsOptional()
  @IsEnum(CaregiverInviteChannel)
  channel?: CaregiverInviteChannel;

  @ApiPropertyOptional({ example: 'sarah.nanny@example.com' })
  @IsOptional()
  @IsEmail()
  invitedEmail?: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsPhoneNumber()
  invitedPhone?: string;

  @ApiPropertyOptional({ example: 'Sarah Jenkins' })
  @IsOptional()
  @IsString()
  invitedName?: string;
}
