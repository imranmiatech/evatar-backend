import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_TEXT_HOLDER,
  SUPPORTED_LANGUAGES,
  SupportedLanguageCode,
} from './language.constants';

@Injectable()
export class LanguageService {
  constructor(private readonly prisma: PrismaService) {}

  getLanguages() {
    return {
      success: true,
      data: SUPPORTED_LANGUAGES,
    };
  }

  async getPreferredLanguage(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferredLanguage: true },
    });

    const language = this.normalizeLanguage(user?.preferredLanguage);

    return {
      success: true,
      data: {
        language,
        languageInfo: this.languageInfo(language),
      },
    };
  }

  async setPreferredLanguage(userId: string, language: SupportedLanguageCode) {
    const savedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { preferredLanguage: language },
      select: {
        id: true,
        preferredLanguage: true,
      },
    });

    return {
      success: true,
      message: 'Preferred language updated',
      data: {
        userId: savedUser.id,
        language: savedUser.preferredLanguage,
        languageInfo: this.languageInfo(savedUser.preferredLanguage),
      },
    };
  }

  async translateForUser(userId: string, value: unknown) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferredLanguage: true },
    });

    return this.translate(value, this.normalizeLanguage(user?.preferredLanguage));
  }

  translate(value: unknown, language: SupportedLanguageCode = DEFAULT_LANGUAGE) {
    const normalizedLanguage = this.normalizeLanguage(language);
    return this.translateValue(value, normalizedLanguage);
  }

  languageInfo(language?: string | null) {
    const normalizedLanguage = this.normalizeLanguage(language);
    return SUPPORTED_LANGUAGES.find((item) => item.code === normalizedLanguage);
  }

  normalizeLanguage(language?: string | null): SupportedLanguageCode {
    const code = language?.trim().toLowerCase();
    const found = SUPPORTED_LANGUAGES.find((item) => item.code === code);
    if (!found) {
      return DEFAULT_LANGUAGE;
    }

    return found.code;
  }

  assertTranslatablePayload(text?: string, data?: Record<string, unknown>) {
    if (!text && !data) {
      throw new BadRequestException('text or data is required');
    }
  }

  private translateValue(
    value: unknown,
    language: SupportedLanguageCode,
  ): unknown {
    if (typeof value === 'string') {
      return LANGUAGE_TEXT_HOLDER[language][value] ?? value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.translateValue(item, language));
    }

    if (value && typeof value === 'object' && !(value instanceof Date)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          this.translateValue(item, language),
        ]),
      );
    }

    return value;
  }
}
