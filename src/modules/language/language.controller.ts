import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SetPreferredLanguageDto, TranslateTextDto } from './dto/language.dto';
import { LanguageService } from './language.service';

@ApiTags('Language')
@ApiBearerAuth()
@Controller('language')
export class LanguageController {
  constructor(private readonly languageService: LanguageService) {}

  @Get()
  @ApiOperation({ summary: 'List supported app languages' })
  getLanguages() {
    return this.languageService.getLanguages();
  }

  @Get('preferred')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user preferred language' })
  getPreferredLanguage(@CurrentUser() user: any) {
    return this.languageService.getPreferredLanguage(user.id);
  }

  @Patch('preferred')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Save current user preferred language' })
  setPreferredLanguage(
    @CurrentUser() user: any,
    @Body() dto: SetPreferredLanguageDto,
  ) {
    return this.languageService.setPreferredLanguage(user.id, dto.language);
  }

  @Post('translate')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Translate backend text/data using language holder and user preference',
  })
  async translate(@CurrentUser() user: any, @Body() dto: TranslateTextDto) {
    this.languageService.assertTranslatablePayload(dto.text, dto.data);
    const language =
      dto.language ??
      (await this.languageService.getPreferredLanguage(user.id)).data.language;
    const input = dto.data ?? dto.text;

    return {
      success: true,
      data: {
        language,
        translated: this.languageService.translate(input, language),
      },
    };
  }
}
