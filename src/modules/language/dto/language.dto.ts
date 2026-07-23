import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { SUPPORTED_LANGUAGES } from '../language.constants';
import type { SupportedLanguageCode } from '../language.constants';

const languageCodes = SUPPORTED_LANGUAGES.map((language) => language.code);

export class SetPreferredLanguageDto {
  @ApiProperty({ example: 'ar', enum: languageCodes })
  @IsString()
  @IsIn(languageCodes)
  language!: SupportedLanguageCode;
}

export class TranslateTextDto {
  @ApiPropertyOptional({ example: 'ar', enum: languageCodes })
  @IsOptional()
  @IsString()
  @IsIn(languageCodes)
  language?: SupportedLanguageCode;

  @ApiPropertyOptional({ example: 'PENDING' })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional({
    example: { status: 'PENDING', message: 'Support chat is not open yet' },
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
