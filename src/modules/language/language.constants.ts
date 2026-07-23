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

export const LANGUAGE_TEXT_HOLDER: Record<
  SupportedLanguageCode,
  Record<string, string>
> = {
  en: {},
  ar: {
    'Account deleted successfully': 'تم حذف الحساب بنجاح',
    ACTIVE: 'نشط',
    ADMIN: 'مشرف',
    APPROVED: 'تمت الموافقة',
    BLOCKED: 'محظور',
    DRAFT: 'مسودة',
    'Cannot reply to a resolved ticket': 'لا يمكن الرد على تذكرة تم حلها',
    DELETED: 'محذوف',
    'English (EN)': 'الإنجليزية (EN)',
    'Experienced Nanny': 'مربية ذات خبرة',
    INACTIVE: 'غير نشط',
    NANNY: 'مربية',
    PARENT: 'ولي أمر',
    PENDING: 'قيد الانتظار',
    PARTNER: 'شريك',
    'Parent User': 'مستخدم ولي أمر',
    REJECTED: 'مرفوض',
    REPLIED: 'تم الرد',
    RESOLVED: 'تم الحل',
    'Super Admin': 'المشرف العام',
    'Support chat is not open yet': 'دردشة الدعم غير مفتوحة بعد',
    SUSPENDED: 'موقوف',
    'Nanny User': 'مستخدم مربية',
    'Ticket is pending. Set status to REPLIED before sending messages.':
      'التذكرة قيد الانتظار. غيّر الحالة إلى تم الرد قبل إرسال الرسائل.',
    'Ticket is resolved. You cannot send messages.':
      'تم حل التذكرة. لا يمكنك إرسال رسائل.',
    TRIAL: 'تجريبي',
  },
  fil: {
    'Account deleted successfully': 'Matagumpay na nabura ang account',
    ACTIVE: 'Aktibo',
    ADMIN: 'Admin',
    APPROVED: 'Naaprubahan',
    BLOCKED: 'Naka-block',
    DRAFT: 'Draft',
    'Cannot reply to a resolved ticket':
      'Hindi maaaring sumagot sa naresolbang ticket',
    DELETED: 'Nabura',
    'English (EN)': 'English (EN)',
    'Experienced Nanny': 'May karanasang yaya',
    INACTIVE: 'Hindi aktibo',
    NANNY: 'Yaya',
    PARENT: 'Magulang',
    PENDING: 'Nakabinbin',
    PARTNER: 'Partner',
    'Parent User': 'Magulang na User',
    REJECTED: 'Tinanggihan',
    REPLIED: 'Nasagot',
    RESOLVED: 'Naresolba',
    'Super Admin': 'Super Admin',
    'Support chat is not open yet': 'Hindi pa bukas ang support chat',
    SUSPENDED: 'Nasuspinde',
    'Nanny User': 'Yaya na User',
    'Ticket is pending. Set status to REPLIED before sending messages.':
      'Nakabinbin ang ticket. Gawing REPLIED ang status bago magpadala ng mensahe.',
    'Ticket is resolved. You cannot send messages.':
      'Naresolba na ang ticket. Hindi ka maaaring magpadala ng mensahe.',
    TRIAL: 'Trial',
  },
  si: {
    'Account deleted successfully': 'ගිණුම සාර්ථකව මකා දමන ලදී',
    ACTIVE: 'සක්‍රීය',
    ADMIN: 'පරිපාලක',
    APPROVED: 'අනුමතයි',
    BLOCKED: 'අවහිරයි',
    DRAFT: 'කෙටුම්පත',
    'Cannot reply to a resolved ticket': 'විසඳූ ටිකට්පතකට පිළිතුරු දිය නොහැක',
    DELETED: 'මකා දැමූ',
    'English (EN)': 'ඉංග්‍රීසි (EN)',
    'Experienced Nanny': 'පළපුරුදු නැනී',
    INACTIVE: 'අක්‍රීය',
    NANNY: 'නැනී',
    PARENT: 'දෙමාපිය',
    PENDING: 'බලාපොරොත්තු වේ',
    PARTNER: 'හවුල්කරු',
    'Parent User': 'දෙමාපිය පරිශීලක',
    REJECTED: 'ප්‍රතික්ෂේපයි',
    REPLIED: 'පිළිතුරු දී ඇත',
    RESOLVED: 'විසඳා ඇත',
    'Super Admin': 'ප්‍රධාන පරිපාලක',
    'Support chat is not open yet': 'සහාය චැට් තවම විවෘත නැත',
    SUSPENDED: 'අත්හිටුවා ඇත',
    'Nanny User': 'නැනී පරිශීලක',
    'Ticket is pending. Set status to REPLIED before sending messages.':
      'ටිකට්පත බලාපොරොත්තු වේ. පණිවිඩ යැවීමට පෙර තත්ත්වය REPLIED කරන්න.',
    'Ticket is resolved. You cannot send messages.':
      'ටිකට්පත විසඳා ඇත. ඔබට පණිවිඩ යැවිය නොහැක.',
    TRIAL: 'අත්හදා බැලීම',
  },
};
