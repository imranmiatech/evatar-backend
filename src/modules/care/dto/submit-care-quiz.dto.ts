import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';

export class SubmitCareQuizAnswerDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  questionId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  selectedOptionId!: string;
}

export class SubmitCareQuizDto {
  @ApiProperty({ type: [SubmitCareQuizAnswerDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmitCareQuizAnswerDto)
  answers!: SubmitCareQuizAnswerDto[];
}
