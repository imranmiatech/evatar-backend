import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class CreateKycSessionDto {
  @ApiPropertyOptional({
    description: 'Two-letter language code for Sumsub SDK localization',
    example: 'en',
  })
  @IsOptional()
  @IsString()
  @Length(2, 8)
  lang?: string;
}
