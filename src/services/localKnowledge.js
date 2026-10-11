/**
 * services/localKnowledge.js
 *
 * Offline local knowledge base search. Pure functions, no network.
 *
 *   searchKnowledge(text, lang) → { entry, answer, answerLang, score, translated } | null
 *
 * Scoring: every keyword (from ALL languages) found in the normalised text adds
 * points proportional to its length; an entry's priority breaks ties and lets
 * safety-critical entries win over general ones. Keywords written as an array
 * (e.g. ['pcos','diet']) must all be present.
 */
import { KNOWLEDGE_BASE } from '../data/kb'
import { DISCLAIMER } from '../i18n/disclaimers'

export const MIN_SCORE = 3

/** Lower-cases, strips punctuation (keeps Indic letters/marks), collapses spaces. */
export function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFC')
    // keep letters, marks (Indic vowel signs), digits and spaces
    .replace(/[^\p{L}\p{M}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const containsAll = (hay, parts) => parts.every((p) => hay.includes(normalize(p)))

/** Points a single keyword scores in `hay` (0 if absent). */
function keywordScore(hay, kw) {
  if (Array.isArray(kw)) return containsAll(hay, kw) ? kw.reduce((n, p) => n + normalize(p).length, 0) + 4 : 0
  const k = normalize(kw)
  if (!k) return 0
  return hay.includes(k) ? Math.min(k.length, 14) : 0
}

function entryScore(entry, hay) {
  let best = 0
  let total = 0
  for (const lang of ['en', 'hi', 'kn']) {
    for (const kw of entry.kw[lang] || []) {
      const s = keywordScore(hay, kw)
      if (s) { total += s; best = Math.max(best, s) }
    }
  }
  if (!best) return 0
  // best keyword dominates; extra matches add a smaller bonus
  return best + Math.min(total - best, 6) + entry.priority * 0.6
}

/** Detects Devanagari / Kannada script in the message. */
export function detectScript(text) {
  if (/[\u0900-\u097F]/.test(text)) return 'hi'
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn'
  return null
}

/**
 * @param {string} text user message
 * @param {'en'|'hi'|'kn'} lang selected UI language
 */
export function searchKnowledge(text, lang = 'en') {
  const hay = normalize(text)
  if (!hay) return null

  let top = null
  for (const entry of KNOWLEDGE_BASE) {
    const score = entryScore(entry, hay)
    if (score >= MIN_SCORE && (!top || score > top.score)) top = { entry, score }
  }
  if (!top) return null

  const wanted = detectScript(text) || lang
  const hasWanted = Boolean(top.entry.a[wanted])
  const answerLang = hasWanted ? wanted : 'en'
  return {
    entry: top.entry,
    id: top.entry.id,
    topic: top.entry.topic,
    score: top.score,
    action: top.entry.action || null,
    critical: Boolean(top.entry.critical),
    answerLang,
    translated: answerLang === wanted,
    answer: withDisclaimer(top.entry, top.entry.a[answerLang], answerLang),
  }
}

export function withDisclaimer(entry, text, lang) {
  if (entry.critical) return text
  return `${text}\n\n${DISCLAIMER[lang] || DISCLAIMER.en}`
}

/** Suggested topic titles in a language (for "what can I ask offline?"). */
export function offlineTopicTitles(lang = 'en', limit = 8) {
  const seen = new Set()
  const out = []
  for (const e of KNOWLEDGE_BASE) {
    if (seen.has(e.topic)) continue
    seen.add(e.topic)
    out.push({ topic: e.topic, title: e.title[lang] || e.title.en })
    if (out.length >= limit) break
  }
  return out
}

export function getEntryById(id) {
  return KNOWLEDGE_BASE.find((e) => e.id === id) || null
}
