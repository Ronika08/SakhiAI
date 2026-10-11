/**
 * components/LanguageSelector.jsx
 *
 * Accessible language picker (English / हिन्दी / ಕನ್ನಡ). A native <select> with a
 * visible label gives full keyboard and screen-reader support. Changing it
 * announces the change politely. Works offline (static dictionary).
 */
import { useState } from 'react'
import { LANGUAGES } from '../i18n/translations'
import { useLanguage } from '../i18n/LanguageContext'

export default function LanguageSelector({ compact = false }) {
  const { lang, setLang, t } = useLanguage()
  const [announce, setAnnounce] = useState('')

  function onChange(e) {
    const code = e.target.value
    setLang(code)
    const picked = LANGUAGES.find((l) => l.code === code)
    setAnnounce(t('lang.changed', { lang: picked?.native || code }))
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <label htmlFor="lang-select" className={compact ? 'sr-only' : undefined} style={{ fontSize: 12, color: '#ad1457', fontWeight: 'bold' }}>
        🌐 {t('lang.label')}
      </label>
      <select id="lang-select" value={lang} onChange={onChange} lang={lang}
        style={{ borderRadius: 10, border: '1.5px solid rgba(194,24,91,0.4)', background: '#fff', color: '#880e4f', padding: '6px 8px', fontSize: 13, minHeight: 36, cursor: 'pointer' }}>
        {LANGUAGES.map((l) => <option key={l.code} value={l.code} lang={l.code}>{l.native}</option>)}
      </select>
      <span role="status" aria-live="polite" className="sr-only">{announce}</span>
    </div>
  )
}
