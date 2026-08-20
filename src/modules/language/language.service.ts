import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  SupportedLanguageCode,
} from './language.constants';

@Injectable()
export class LanguageService {
  private readonly translationCache = new Map<string, string>();
  private readonly googleTranslateApiUrl =
    'https://translation.googleapis.com/language/translate/v2';
  private hasLoggedMissingGoogleApiKey = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

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

  async translateForUserAsync(userId: string, value: unknown) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferredLanguage: true },
    });

    return this.translateAsync(
      value,
      this.normalizeLanguage(user?.preferredLanguage),
    );
  }

  async translateAsync(
    value: unknown,
    language: SupportedLanguageCode = DEFAULT_LANGUAGE,
  ) {
    const normalizedLanguage = this.normalizeLanguage(language);
    return this.translateValueAsync(value, normalizedLanguage);
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
    const code = language?.trim().toLowerCase().split('-')[0];
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
      return value;
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

  private async translateValueAsync(
    value: unknown,
    language: SupportedLanguageCode,
    key?: string,
  ): Promise<unknown> {
    if (language === DEFAULT_LANGUAGE) {
      return value;
    }

    if (typeof value === 'string') {
      return this.translateString(value, language, key);
    }

    if (Array.isArray(value)) {
      return Promise.all(
        value.map((item) => this.translateValueAsync(item, language, key)),
      );
    }

    if (value && typeof value === 'object' && !(value instanceof Date)) {
      const entries = await Promise.all(
        Object.entries(value).map(async ([itemKey, item]) => [
          itemKey,
          await this.translateValueAsync(item, language, itemKey),
        ]),
      );

      return Object.fromEntries(entries);
    }

    return value;
  }

  private async translateString(
    value: string,
    language: SupportedLanguageCode,
    key?: string,
  ) {
    if (this.shouldSkipTranslation(value, key)) {
      return value;
    }

    const cacheKey = `${language}:${value}`;
    const cached = this.translationCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const translated = await this.translateWithProvider(value, language);
    this.translationCache.set(cacheKey, translated);

    return translated;
  }

  private shouldSkipTranslation(value: string, key?: string) {
    const trimmed = value.trim();
    const normalizedKey = key?.toLowerCase();

    if (!trimmed || trimmed.length < 2) {
      return true;
    }

    if (
      normalizedKey &&
      [
        'id',
        'userid',
        'childid',
        'nannyuserid',
        'parentuserid',
        'email',
        'phonenumber',
        'phone',
        'passwordhash',
        'profilepictureurl',
        'fileurl',
        's3key',
        'mimetype',
        'accesstoken',
        'refreshtoken',
        'token',
        'preferredlanguage',
        'language',
        'createdat',
        'updatedat',
        'submittedat',
        'reviewedat',
        'birthdate',
      ].includes(normalizedKey)
    ) {
      return true;
    }

    if (/^https?:\/\//i.test(trimmed)) return true;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return true;
    if (/^\+?[0-9\s().-]{6,}$/.test(trimmed)) return true;
    if (/^[a-z0-9_-]{14,}$/i.test(trimmed)) return true;
    if (/^\d{4}-\d{2}-\d{2}t/i.test(trimmed)) return true;
    if (/^[A-Z0-9_]+$/.test(trimmed)) return false;
    if (!/[a-zA-Z]/.test(trimmed)) return true;

    return false;
  }

  private async translateWithProvider(
    value: string,
    language: SupportedLanguageCode,
  ) {
    const googleApiKey = this.configService.get<string>(
      'GOOGLE_TRANSLATE_API_KEY',
    );

    try {
      if (!googleApiKey) {
        if (!this.hasLoggedMissingGoogleApiKey) {
          this.hasLoggedMissingGoogleApiKey = true;
          console.warn(
            'GOOGLE_TRANSLATE_API_KEY is not configured; translation is disabled.',
          );
        }
        return value;
      }

      return await this.translateWithGoogleCloud(value, language, googleApiKey);
    } catch (error) {
      console.error('Translation provider failed:', error);
      return value;
    }
  }

  private providerLanguageCode(language: SupportedLanguageCode) {
    return language;
  }

  private async translateWithGoogleCloud(
    value: string,
    language: SupportedLanguageCode,
    apiKey: string,
  ) {
    const response = await fetch(
      `${this.googleTranslateApiUrl}?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: value,
          target: this.providerLanguageCode(language),
          format: 'text',
        }),
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Google Cloud translate failed with HTTP ${response.status}`,
      );
    }

    const payload = (await response.json()) as {
      data?: { translations?: Array<{ translatedText?: string }> };
    };

    return payload.data?.translations?.[0]?.translatedText || value;
  }
}
