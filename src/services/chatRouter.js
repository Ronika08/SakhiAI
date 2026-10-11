/**
 * services/chatRouter.js
 *
 * OFFLINE-FIRST chat routing. Gemini is an ONLINE FALLBACK, never the default.
 *
 *   User message
 *     ↓ 1. Rule Engine        (local, instant — emergency rules first)
 *     ↓ 2. Intent Engine      (local — refines a matched rule category)
 *     ↓ 3. Local Knowledge    (local — periods, PCOS, pregnancy, nutrition,
 *     ↓                        women's health, first aid, safety, mental
 *     ↓                        wellbeing, medicine safety, trackers, wellness,
 *     ↓                        emergency guidance; English / Hindi / Kannada)
 *     ↓ answered locally? ──YES──► reply (NO network request is made)
 *     ↓ NO
 *     ↓ 4. Connectivity check
 *     ├─ offline / server unreachable ──► offline reply (still no AI)
 *     └─ online ──► backend /api/chat ──► Gemini (backend-owned model & key)
 *
 * `routeChat()` is a pure orchestration function with injectable dependencies,
 * so every branch is unit-tested without a network.
 */
import { getRuleResponse } from './chatService'
import { searchKnowledge, getEntryById, offlineTopicTitles, withDisclaimer, detectScript } from './localKnowledge'
import { translate, normalizeLang } from '../i18n/translate'
import { isOnline, reportNetworkFailure, reportNetworkSuccess } from './connectivity'
import api from './apiClient'

/** Rule category / intent → local KB entry id, used to answer rule matches in hi/kn. */
const RULE_TO_KB = {
  Emergency: 'emergency-danger',
  Periods: 'periods-overview',
  PCOS: 'pcos-overview',
  Pregnancy: 'pregnancy-overview',
  Nutrition: 'nutrition-overview',
  'Mental Health': 'anxiety-breathing',
  "Women's Safety": 'safety-travel',
  'First Aid': 'first-aid-overview',
  'Medication Disclaimer': 'med-painkillers',
}
const INTENT_TO_KB = {
  'Periods:Cramps': 'period-cramps', 'Periods:Heavy Bleeding': 'heavy-periods',
  'Periods:Missed / Late Period': 'irregular-periods', 'Periods:Irregular Period': 'irregular-periods',
  'PCOS:Diet': 'pcos-diet', 'PCOS:Symptoms': 'pcos-symptoms',
  'Pregnancy:Early Symptoms': 'pregnancy-early-signs', 'Pregnancy:Morning Sickness': 'morning-sickness',
  'Pregnancy:Nutrition': 'pregnancy-nutrition', 'Pregnancy:Warning Signs': 'pregnancy-warning',
  'Nutrition:Iron': 'iron-foods', 'Nutrition:Hydration': 'hydration',
  'Mental Health:Anxiety': 'anxiety-breathing', 'Mental Health:Stress': 'anxiety-breathing',
}
const GREETING = {
  hi: '👋 नमस्ते! मैं SakhiAI हूँ। आज मैं आपकी कैसे मदद कर सकती हूँ?',
  kn: '👋 ನಮಸ್ಕಾರ! ನಾನು SakhiAI. ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?',
}

/** Language to answer in: script of the message wins, else the selected UI language. */
export function answerLanguage(text, lang) {
  return detectScript(text) || normalizeLang(lang)
}

/** Localises an English rule/intent match when a translation exists offline. */
export function localizeRuleReply(rule, text, lang) {
  const target = answerLanguage(text, lang)
  if (target === 'en') return { reply: rule.reply, lang: 'en', translated: true }

  if (rule.category === 'Greeting') return { reply: GREETING[target], lang: target, translated: true }

  const id = INTENT_TO_KB[`${rule.category}:${rule.intent}`] || RULE_TO_KB[rule.category]
  const entry = id && getEntryById(id)
  if (entry?.a[target]) {
    return { reply: withDisclaimer(entry, entry.a[target], target), lang: target, translated: true }
  }
  return { reply: rule.reply, lang: 'en', translated: false }
}

const HELPLINES = {
  en: '📞 India: Emergency 112 · Women Helpline 1091 / 181 · Ambulance 108 · Police 100.',
  hi: '📞 भारत: आपातकाल 112 · महिला हेल्पलाइन 1091 / 181 · एम्बुलेंस 108 · पुलिस 100।',
  kn: '📞 ಭಾರತ: ತುರ್ತು 112 · ಮಹಿಳಾ ಸಹಾಯವಾಣಿ 1091 / 181 · ಆಂಬ್ಯುಲೆನ್ಸ್ 108 · ಪೊಲೀಸ್ 100.',
}

/** Emergency replies must always carry the emergency numbers, in the reply language. */
export function ensureHelplines(reply, lang) {
  return /\b112\b/.test(reply) ? reply : `${reply}\n\n${HELPLINES[lang] || HELPLINES.en}`
}

function offlineReply(lang, reason) {
  const l = normalizeLang(lang)
  const topics = offlineTopicTitles(l, 12).map((x) => `• ${x.title}`).join('\n')
  const body = translate(l, reason === 'server_unreachable' ? 'chat.offline.server' : 'chat.offline.body')
  return `${translate(l, 'chat.offline.title')}\n\n${body}\n\n${translate(l, 'chat.offline.topics')}\n${topics}`
}

/**
 * @param {Object} p
 * @param {string} p.text         user message
 * @param {Array}  p.history      prior messages [{role, content}] (without `text`)
 * @param {'en'|'hi'|'kn'} p.lang selected language
 * @param {Object} [p.deps]       injectable dependencies (tests)
 * @returns {Promise<{
 *   source: 'rule'|'kb'|'ai'|'offline'|'ai-error',
 *   reply: string, action: string|null, category: string|null, intent: string|null,
 *   lang: string, translated: boolean, usedNetwork: boolean, critical: boolean
 * }>}
 */
export async function routeChat({ text, history = [], lang = 'en', deps = {} }) {
  const {
    getRule = getRuleResponse,
    searchKb = searchKnowledge,
    online = isOnline,
    ask = (body) => api('/api/chat', { method: 'POST', auth: false, body }),
  } = deps
  const language = normalizeLang(lang)
  const base = { action: null, category: null, intent: null, lang: language, translated: true, usedNetwork: false, critical: false }

  // 1 + 2. Rule Engine → Intent Engine (the engine applies the intent itself)
  const rule = getRule(text)
  if (rule) {
    const localized = localizeRuleReply(rule, text, language)
    return {
      ...base, source: 'rule', reply: rule.isEmergency ? ensureHelplines(localized.reply, localized.lang) : localized.reply, lang: localized.lang, translated: localized.translated,
      action: rule.action || null, category: rule.category, intent: rule.intent || null, critical: Boolean(rule.isEmergency),
    }
  }

  // 3. Local knowledge base (offline)
  const kb = searchKb(text, language)
  if (kb) {
    return {
      ...base, source: 'kb', reply: kb.answer, lang: kb.answerLang, translated: kb.translated,
      action: kb.action, category: kb.topic, intent: kb.id, critical: kb.critical,
    }
  }

  // 4. Not answerable locally → connectivity check
  if (!online()) {
    return { ...base, source: 'offline', reply: offlineReply(language, 'offline') }
  }

  // 5. Online → backend → Gemini (backend owns provider, model, prompt)
  try {
    const messages = [...history, { role: 'user', content: text }].map((m) => ({ role: m.role, content: m.content }))
    const data = await ask({ messages, language })
    reportNetworkSuccess()
    if (!data?.response) throw Object.assign(new Error('empty'), { code: 'AI_BAD_RESPONSE' })
    return {
      ...base, source: 'ai', reply: data.response, usedNetwork: true,
      category: data.safety?.category || null, critical: Boolean(data.safety?.category),
    }
  } catch (err) {
    const networkDown = ['NETWORK_OFFLINE', 'NETWORK_ERROR', 'TIMEOUT'].includes(err?.code)
    if (networkDown) {
      reportNetworkFailure()
      return { ...base, source: 'offline', usedNetwork: true, reply: offlineReply(language, err.code === 'NETWORK_OFFLINE' ? 'offline' : 'server_unreachable') }
    }
    const fallback = err?.data?.fallbackResponse
    return {
      ...base, source: 'ai-error', usedNetwork: true,
      reply: fallback || (err?.code === 'RATE_LIMITED'
        ? translate(language, 'chat.offline.server')
        : translate(language, 'chat.offline.server')),
    }
  }
}

export default routeChat
