import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AssignCareModuleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  moduleId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  childId: string;

  @ApiProperty({
    description:
      'Nanny User ID. Care team accessId is also accepted and will be resolved to invitedUserId.',
    example: '67ac3bb5-7de1-4ba2-baa7-bdeba853bd5a',
  })
  @IsString()
  @IsNotEmpty()
  nannyUserId: string;
}
