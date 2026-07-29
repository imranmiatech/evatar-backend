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

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nannyUserId: string;
}
