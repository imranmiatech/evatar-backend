import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class NannyProfileQueryDto {
  @ApiProperty({
    example: 'cmrwwed7q0000aalr1ka7hzth',
    description: 'Child id used to scope the nanny profile to one family.',
  })
  @IsString()
  childId!: string;

  @ApiPropertyOptional({
    enum: ['overview', 'week', 'month'],
    default: 'overview',
    description: 'Controls the task range returned with the profile.',
  })
  @IsOptional()
  @IsIn(['overview', 'week', 'month'])
  period?: 'overview' | 'week' | 'month';

  @ApiPropertyOptional({
    default: 10,
    minimum: 1,
    maximum: 50,
    description: 'Maximum number of task rows returned.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
