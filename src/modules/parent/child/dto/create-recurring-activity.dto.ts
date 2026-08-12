import { ApiProperty } from '@nestjs/swagger';
import { DayOfWeek } from '@prisma/client';
import { IsArray, IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class CreateRecurringActivityDto {
  @ApiProperty({ example: 'Home education schedule' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    enum: DayOfWeek,
    isArray: true,
    example: [DayOfWeek.MON, DayOfWeek.WED],
  })
  @IsArray()
  @IsEnum(DayOfWeek, { each: true })
  days: DayOfWeek[];

  @ApiProperty({ example: '09:00' })
  @IsString()
  @IsNotEmpty()
  startTime: string;

  @ApiProperty({ example: '10:00' })
  @IsString()
  @IsNotEmpty()
  endTime: string;
}
