import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class AssignCareModuleDto {
  @ApiProperty({ description: 'The ID of the child to assign the module for' })
  @IsNotEmpty()
  @IsUUID()
  @IsString()
  childId: string;
}
