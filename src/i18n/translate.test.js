import { describe, it, expect, beforeEach } from 'vitest'
import { translate, normalizeLang, speechLocale, detectInitialLanguage, LANG_STORAGE_KEY } from './translate'
import { translations, LANGUAGES, DEFAULT_LANGUAGE } from './translations'

describe('translation dictionary', () => {
  it('supports English (default), Hindi and Kannada', () => {
    expect(LANGUAGES.map((l) => l.code)).toEqual(['en', 'hi', 'kn'])
    expect(DEFAULT_LANGUAGE).toBe('en')
  })
  it('Hindi and Kannada define every English key (no silent English gaps)', () => {
    const en = Object.keys(translations.en)
    for (const l of ['hi', 'kn']) {
      const missing = en.filter((k) => !(k in translations[l]))
      expect(missing, `${l} is missing: ${missing.join(', ')}`).toEqual([])
    }
  })
  it('translated strings use the right script and keep placeholders', () => {
    for (const k of Object.keys(translations.en)) {
      const ph = (translations.en[k].match(/\{\w+\}/g) || []).sort().join()
      expect((translations.hi[k].match(/\{\w+\}/g) || []).sort().join(), `hi ${k}`).toBe(ph)
      expect((translations.kn[k].match(/\{\w+\}/g) || []).sort().join(), `kn ${k}`).toBe(ph)
    }
    expect(translations.hi['nav.home']).toMatch(/[\u0900-\u097F]/)
    expect(translations.kn['nav.home']).toMatch(/[\u0C80-\u0CFF]/)
  })
  it('emergency numbers stay as digits in every language', () => {
    for (const l of ['en', 'hi', 'kn']) expect(translations[l]['sos.queued.body']).toMatch(/112/)
  })
  it('clearly labels OFFLINE AVAILABLE vs INTERNET REQUIRED in English', () => {
    expect(translations.en['conn.available']).toBe('OFFLINE AVAILABLE')
    expect(translations.en['conn.required']).toBe('INTERNET REQUIRED')
  })
})

describe('translate()', () => {
  it('returns the requested language', () => {
    expect(translate('en', 'nav.home')).toBe('Home')
    expect(translate('hi', 'nav.home')).toBe('होम')
    expect(translate('kn', 'nav.home')).toBe('ಹೋಮ್')
  })
  it('interpolates variables', () => {
    expect(translate('en', 'home.welcome', { app: 'SakhiAI' })).toBe('Welcome to SakhiAI 🌸')
    expect(translate('hi', 'sync.pending', { n: 3 })).toContain('3')
  })
  it('falls back to English for unknown languages and to the key for unknown keys', () => {
    expect(translate('fr', 'nav.home')).toBe('Home')
    expect(translate('hi', 'no.such.key')).toBe('no.such.key')
  })
  it('normalizeLang / speechLocale', () => {
    expect(normalizeLang('xx')).toBe('en')
    expect(normalizeLang('kn')).toBe('kn')
    expect(speechLocale('hi')).toBe('hi-IN')
    expect(speechLocale('kn')).toBe('kn-IN')
    expect(speechLocale('en')).toBe('en-IN')
    expect(speechLocale('zz')).toBe('en-IN')
  })
})

describe('detectInitialLanguage', () => {
  beforeEach(() => localStorage.clear())
  it('defaults to English', () => {
    expect(detectInitialLanguage()).toBe('en')
  })
  it('restores a saved choice', () => {
    localStorage.setItem(LANG_STORAGE_KEY, JSON.stringify('kn'))
    expect(detectInitialLanguage()).toBe('kn')
  })
  it('ignores a corrupt or unsupported saved value', () => {
    localStorage.setItem(LANG_STORAGE_KEY, '"zz"')
    expect(detectInitialLanguage()).toBe('en')
    localStorage.setItem(LANG_STORAGE_KEY, '{bad')
    expect(detectInitialLanguage()).toBe('en')
  })
})
