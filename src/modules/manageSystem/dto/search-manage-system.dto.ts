import { ApiPropertyOptional } from '@nestjs/swagger';
import { CaregiverAccessRole } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class SearchManageSystemDto {
  @ApiPropertyOptional({ example: 'emily@alurei.app' })
  @IsString()
  @IsOptional()
  query?: string;

  @ApiPropertyOptional({ example: 'cmrwwed7q0000aalr1ka7hzth' })
  @IsString()
  @IsOptional()
  childId?: string;

  @ApiPropertyOptional({
    enum: CaregiverAccessRole,
    example: CaregiverAccessRole.NANNY,
  })
  @IsEnum(CaregiverAccessRole)
  @IsOptional()
  role?: CaregiverAccessRole;
}
