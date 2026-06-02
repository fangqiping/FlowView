export type SupportedLanguage = 'en-US' | 'zh-Hans-CN'

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en-US'

export const SUPPORTED_LANGUAGES: Array<{ code: SupportedLanguage; label: string; nativeLabel: string }> = [
  { code: 'en-US', label: 'English (United States)', nativeLabel: 'English' },
  { code: 'zh-Hans-CN', label: 'Chinese (Mainland China)', nativeLabel: '简体中文' },
]

const aliases: Record<string, SupportedLanguage> = {
  en: 'en-US',
  'en-us': 'en-US',
  zh: 'zh-Hans-CN',
  'zh-cn': 'zh-Hans-CN',
  'zh-hans': 'zh-Hans-CN',
  'zh-hans-cn': 'zh-Hans-CN',
}

export function canonicalizeLanguage(language: string | undefined | null): SupportedLanguage {
  if (!language) {
    return DEFAULT_LANGUAGE
  }

  return aliases[language.toLowerCase()] ?? DEFAULT_LANGUAGE
}
