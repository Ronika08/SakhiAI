import { describe, it, expect } from 'vitest'
import { searchKnowledge, normalize, offlineTopicTitles } from './localKnowledge'
import { KNOWLEDGE_BASE, KB_TOPICS } from '../data/kb'

describe('knowledge base content integrity', () => {
  it('covers every required topic', () => {
    const topics = new Set(KNOWLEDGE_BASE.map((e) => e.topic))
    for (const t of KB_TOPICS) expect(topics.has(t), `missing topic ${t}`).toBe(true)
  })
  it('has unique ids', () => {
    const ids = KNOWLEDGE_BASE.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it.each(KNOWLEDGE_BASE.map((e) => [e.id, e]))('%s has English, Hindi and Kannada answers + keywords + title', (_id, e) => {
    for (const l of ['en', 'hi', 'kn']) {
      expect(e.a[l]?.length, `${e.id} ${l} answer`).toBeGreaterThan(60)
      expect(e.kw[l]?.length, `${e.id} ${l} keywords`).toBeGreaterThan(0)
      expect(e.title[l]).toBeTruthy()
    }
    expect(e.a.hi).toMatch(/[\u0900-\u097F]/)
    expect(e.a.kn).toMatch(/[\u0C80-\u0CFF]/)
  })
  it('contains emergency numbers in safety-critical answers (all languages)', () => {
    for (const e of KNOWLEDGE_BASE.filter((x) => x.critical)) {
      for (const l of ['en', 'hi', 'kn']) expect(e.a[l], `${e.id}/${l}`).toMatch(/112|108|1091|14416|1930/)
    }
  })
  it('never gives medicine doses (mg / tablets-per-day) in any answer', () => {
    const dose = /\b\d+(\.\d+)?\s?(mg|mcg|ml|iu)\b|\b\d+\s+(tablets?|pills?|capsules?)\b/i
    for (const e of KNOWLEDGE_BASE) for (const l of ['en', 'hi', 'kn']) expect(e.a[l], `${e.id}/${l}`).not.toMatch(dose)
  })
  it('never states a definite diagnosis', () => {
    for (const e of KNOWLEDGE_BASE) expect(e.a.en).not.toMatch(/(?<!not mean )\byou (definitely |certainly )?have (pcos|pcod|endometriosis|diabetes|thyroid|anaemia|anemia)\b/i)
  })
})

describe('searchKnowledge', () => {
  it('returns null for unknown topics and noise', () => {
    expect(searchKnowledge('explain endometriosis')).toBeNull()
    expect(searchKnowledge('what is the capital of france')).toBeNull()
    expect(searchKnowledge('')).toBeNull()
    expect(searchKnowledge('   ')).toBeNull()
    expect(searchKnowledge(null)).toBeNull()
  })
  it('appends the educational disclaimer to non-critical answers only', () => {
    expect(searchKnowledge('how long is a cycle').answer).toMatch(/not a diagnosis|not medical advice/i)
    expect(searchKnowledge('how to treat a burn').critical).toBe(true)
  })
  it('PCOS diet/symptoms prefer the specific entry', () => {
    expect(searchKnowledge('pcos diet').id).toBe('pcos-diet')
    expect(searchKnowledge('what are pcos symptoms').id).toBe('pcos-symptoms')
    expect(searchKnowledge('tell me about pcos').id).toBe('pcos-overview')
  })
  it('emergency/medical red flags outrank general entries', () => {
    expect(searchKnowledge('i have chest pain').topic).toBe('emergency')
    expect(searchKnowledge('bleeding while pregnant').id).toBe('pregnancy-warning')
    expect(searchKnowledge('someone is following me').topic).toBe('emergency')
  })
  it('matches keywords from any language regardless of selected UI language', () => {
    expect(searchKnowledge('पीरियड में दर्द', 'en').id).toBe('period-cramps')
    expect(searchKnowledge('period cramps', 'kn').answerLang).toBe('kn')
  })
  it('chat suggestion chips in every language resolve to a local answer', () => {
    const chips = {
      en: ['Period cramps relief', 'PCOS diet tips', 'Ovulation signs', 'Stress & hormones'],
      hi: ['पीरियड में दर्द से राहत', 'PCOS आहार सुझाव', 'ओव्यूलेशन के संकेत', 'तनाव और हार्मोन'],
      kn: ['ಮುಟ್ಟಿನ ನೋವಿಗೆ ಪರಿಹಾರ', 'PCOS ಆಹಾರ ಸಲಹೆ', 'ಅಂಡೋತ್ಪತ್ತಿಯ ಲಕ್ಷಣ', 'ಒತ್ತಡ ಮತ್ತು ಹಾರ್ಮೋನ್'],
    }
    for (const [lang, list] of Object.entries(chips)) for (const c of list) expect(searchKnowledge(c, lang), `${lang}: ${c}`).not.toBeNull()
  })
  it('normalize keeps Indic marks and strips punctuation', () => {
    expect(normalize('  Hello, WORLD!! ')).toBe('hello world')
    expect(normalize('ಮುಟ್ಟಿನ, ನೋವು?')).toBe('ಮುಟ್ಟಿನ ನೋವು')
  })
  it('offers topic titles for the offline reply in the requested language', () => {
    expect(offlineTopicTitles('hi', 4)[0].title).toMatch(/[\u0900-\u097F]/)
    expect(offlineTopicTitles('en', 12).length).toBeGreaterThanOrEqual(8)
  })
})
