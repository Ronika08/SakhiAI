import { translations, DEFAULT_LANGUAGE, LANGUAGES } from './translations'

export const SUPPORTED = LANGUAGES.map((l) => l.code)
export const LANG_STORAGE_KEY = 'sakhi_lang'

export function normalizeLang(code) {
  return SUPPORTED.includes(code) ? code : DEFAULT_LANGUAGE
}

/** Pure translate function: language → key → text, with {var} interpolation and English fallback. */
export function translate(lang, key, vars) {
  const l = normalizeLang(lang)
  let text = translations[l]?.[key] ?? translations[DEFAULT_LANGUAGE][key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v))
  return text
}

export function speechLocale(lang) {
  return LANGUAGES.find((l) => l.code === normalizeLang(lang))?.speech || 'en-IN'
}

/** Initial language: saved choice → browser language → English. */
export function detectInitialLanguage() {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY)
    if (saved && SUPPORTED.includes(JSON.parse(saved))) return JSON.parse(saved)
  } catch { /* ignore */ }
  try {
    const nav = (navigator.language || '').slice(0, 2)
    // Only auto-pick a non-English language if the user's browser asks for it.
    if (SUPPORTED.includes(nav)) return nav
  } catch { /* ignore */ }
  return DEFAULT_LANGUAGE
}
