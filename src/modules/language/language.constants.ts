export const SUPPORTED_LANGUAGES = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    label: 'English (EN)',
  },
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'عربي',
    label: 'Arabic',
  },
  {
    code: 'fil',
    name: 'Filipino',
    nativeName: 'Wikang Filipino',
    label: 'Filipino',
  },
  {
    code: 'si',
    name: 'Sinhala',
    nativeName: 'සිංහල',
    label: 'Sinhala',
  },
] as const;

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

export const DEFAULT_LANGUAGE: SupportedLanguageCode = 'en';
