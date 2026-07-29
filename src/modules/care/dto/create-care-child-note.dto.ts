import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCareChildNoteDto {
  @ApiProperty({
    example: 'Eve prefers reading before bedtime.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  note!: string;
}
