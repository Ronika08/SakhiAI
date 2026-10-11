/**
 * i18n/LanguageContext.jsx – selected language (en/hi/kn), persisted locally.
 * Works fully offline: translations are bundled and precached.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { translate, normalizeLang, detectInitialLanguage, LANG_STORAGE_KEY } from './translate'

const LanguageContext = createContext({ lang: 'en', setLang: () => {}, t: (k) => k })

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(detectInitialLanguage)

  useEffect(() => {
    document.documentElement.lang = lang
    try { localStorage.setItem(LANG_STORAGE_KEY, JSON.stringify(lang)) } catch { /* storage unavailable */ }
  }, [lang])

  const setLang = useCallback((code) => setLangState(normalizeLang(code)), [])
  const t = useCallback((key, vars) => translate(lang, key, vars), [lang])
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export const useLanguage = () => useContext(LanguageContext)
