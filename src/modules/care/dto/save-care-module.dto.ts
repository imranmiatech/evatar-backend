import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SaveCareModuleDto {
  @ApiProperty({
    example: 'child_eve_001',
    description: 'Child ID to save/remove this module for.',
  })
  @IsString()
  @IsNotEmpty()
  childId!: string;
}
