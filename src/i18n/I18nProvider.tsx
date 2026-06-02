import { createContext, useCallback, useMemo, useState, type ReactNode } from 'react'
import { setApiLanguage } from '../lib/api'
import { DEFAULT_LANGUAGE, canonicalizeLanguage, type SupportedLanguage } from './languages'
import { formatMessage, type MessageKey, type Messages } from './messages'
import { enUSMessages } from './messages.en-US'
import { zhHansCNMessages } from './messages.zh-Hans-CN'

const STORAGE_KEY = 'flowview.language'

const dictionaries: Record<SupportedLanguage, Messages> = {
  'en-US': enUSMessages,
  'zh-Hans-CN': zhHansCNMessages,
}

export interface I18nContextValue {
  language: SupportedLanguage
  setLanguage: (language: SupportedLanguage) => void
  t: (key: MessageKey, params?: Record<string, string | number>) => string
}

export const I18nContext = createContext<I18nContextValue | null>(null)

function getInitialLanguage(): SupportedLanguage {
  const storedValue = localStorage.getItem(STORAGE_KEY)
  const stored = canonicalizeLanguage(storedValue)
  if (stored !== DEFAULT_LANGUAGE || storedValue) {
    return stored
  }

  return canonicalizeLanguage(navigator.language)
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    const initial = getInitialLanguage()
    setApiLanguage(initial)
    return initial
  })

  const setLanguage = useCallback((nextLanguage: SupportedLanguage) => {
    localStorage.setItem(STORAGE_KEY, nextLanguage)
    setApiLanguage(nextLanguage)
    setLanguageState(nextLanguage)
  }, [])

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key, params) => formatMessage(dictionaries[language][key], params),
    }),
    [language, setLanguage],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
