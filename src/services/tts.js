/** services/tts.js – read replies aloud with the device's own speech synthesis (works offline where voices are installed). */
import { speechLocale } from '../i18n/translate'

export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'

export function speak(text, lang = 'en') {
  if (!ttsSupported() || !text) return false
  try {
    window.speechSynthesis.cancel()
    const clean = String(text).replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, '').slice(0, 1500)
    const u = new SpeechSynthesisUtterance(clean)
    u.lang = speechLocale(lang)
    window.speechSynthesis.speak(u)
    return true
  } catch { return false }
}

export const stopSpeaking = () => { try { window.speechSynthesis?.cancel() } catch { /* ignore */ } }
