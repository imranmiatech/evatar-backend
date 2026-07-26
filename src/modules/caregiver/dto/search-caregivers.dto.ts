import { ApiPropertyOptional } from '@nestjs/swagger';
import { CaregiverAccessRole } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class SearchCaregiversDto {
  @ApiPropertyOptional({ example: 'deepa' })
  @IsString()
  @IsOptional()
  query?: string;

  @ApiPropertyOptional({
    enum: CaregiverAccessRole,
    example: CaregiverAccessRole.NANNY,
  })
  @IsEnum(CaregiverAccessRole)
  @IsOptional()
  role?: CaregiverAccessRole;

  @ApiPropertyOptional({
    example: 'cmrwwed7q0000aalr1ka7hzth',
    description:
      'Optional child id. When query and role are empty, this filters the manage caregivers list.',
  })
  @IsString()
  @IsOptional()
  childId?: string;
}
