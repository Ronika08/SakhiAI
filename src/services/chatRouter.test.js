import { describe, it, expect, vi, beforeEach } from 'vitest'
import { routeChat } from './chatRouter'
import { _resetConnectivity } from './connectivity'

/**
 * OFFLINE-FIRST routing: Rule Engine → Intent Engine → Local Knowledge →
 * connectivity → Gemini. "No network request" is proven twice: the injected
 * `ask` is never called AND the global fetch is never called.
 */
const AI = { response: 'AI says hello', safety: { aiCalled: true } }

function setup({ online = true, ask } = {}) {
  const askFn = ask || vi.fn(async () => AI)
  const onlineFn = vi.fn(() => online)
  return { askFn, onlineFn, run: (text, lang = 'en', history = []) => routeChat({ text, lang, history, deps: { ask: askFn, online: onlineFn } }) }
}

describe('known questions are answered locally with NO network request', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); _resetConnectivity() })

  it.each([
    ['why are my periods irregular', 'periods'],
    ['how long should a period last', 'periods'],
    ['what is a normal cycle length', 'periods'],
    ['how to relieve period cramps', 'periods'],
    ['my period is late', 'periods'],
  ])('PERIOD: "%s"', async (q) => {
    const { run, askFn } = setup()
    const r = await run(q)
    expect(['rule', 'kb']).toContain(r.source)
    expect(r.usedNetwork).toBe(false)
    expect(r.reply.length).toBeGreaterThan(40)
    expect(askFn).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(['I have PCOS', 'PCOS diet', 'PCOS symptoms', 'what is pcod'])('PCOS: "%s"', async (q) => {
    const { run, askFn } = setup()
    const r = await run(q)
    expect(['rule', 'kb']).toContain(r.source)
    expect(askFn).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([
    ['Someone is following me', 'emergency'],
    ['I feel unsafe walking home at night', 'safety'],
    ['how can I travel safely alone at night', 'safety'],
    ['how do I report harassment', 'safety'],
    ['what are the emergency numbers', 'emergency'],
  ])('SAFETY: "%s"', async (q) => {
    const { run, askFn } = setup()
    const r = await run(q)
    expect(['rule', 'kb']).toContain(r.source)
    if (r.critical) expect(r.reply).toMatch(/112/)
    expect(askFn).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([
    'how to treat a minor burn', 'how do I stop bleeding from a cut', 'what to do if someone faints',
    'someone is choking what do I do', 'first aid basics',
  ])('FIRST AID: "%s"', async (q) => {
    const { run, askFn } = setup()
    const r = await run(q)
    expect(['rule', 'kb']).toContain(r.source)
    expect(askFn).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([
    'iron rich foods', 'how much water should I drink', 'what should I eat during my period',
    'foods for a balanced diet', 'folic acid in pregnancy',
  ])('NUTRITION: "%s"', async (q) => {
    const { run, askFn } = setup()
    const r = await run(q)
    expect(['rule', 'kb']).toContain(r.source)
    expect(askFn).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([
    'I am pregnant what should I eat', 'signs of pregnancy', 'morning sickness remedies', 'bleeding during pregnancy',
    'I feel anxious and stressed', 'I cannot sleep', 'give me medicine dosage', 'which painkiller should I take',
    'how does the cycle tracker work', 'breast self exam', 'UTI burning urination',
  ])('OTHER TOPICS: "%s"', async (q) => {
    const { run, askFn } = setup()
    const r = await run(q)
    expect(['rule', 'kb']).toContain(r.source)
    expect(askFn).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('works fully offline for known questions (no connectivity check needed)', async () => {
    const { run, askFn, onlineFn } = setup({ online: false })
    const r = await run('PCOS diet')
    expect(r.source).toBe('rule')
    expect(askFn).not.toHaveBeenCalled()
    expect(onlineFn).not.toHaveBeenCalled()
  })

  it('emergency answers open the Emergency screen and are flagged critical', async () => {
    const { run } = setup()
    const r = await run('Someone is following me')
    expect(r).toMatchObject({ action: 'OPEN_EMERGENCY', critical: true, usedNetwork: false })
  })
})

describe('unknown questions', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); _resetConnectivity() })

  it('unknown question + internet → backend → Gemini (only messages + language sent)', async () => {
    const { run, askFn } = setup({ online: true })
    const r = await run('Explain endometriosis', 'en', [{ role: 'assistant', content: 'Hi' }])
    expect(r).toMatchObject({ source: 'ai', reply: 'AI says hello', usedNetwork: true })
    expect(askFn).toHaveBeenCalledTimes(1)
    const body = askFn.mock.calls[0][0]
    expect(Object.keys(body).sort()).toEqual(['language', 'messages'])
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'Explain endometriosis' })
    expect(JSON.stringify(body)).not.toMatch(/model|api[_-]?key|system/i)
  })

  it('unknown question + NO internet → offline response, Gemini is NOT contacted', async () => {
    const { run, askFn } = setup({ online: false })
    const r = await run('Explain endometriosis')
    expect(r.source).toBe('offline')
    expect(r.usedNetwork).toBe(false)
    expect(r.reply).toMatch(/offline/i)
    expect(r.reply).toMatch(/112/)
    expect(r.reply).toMatch(/Periods|PCOS/i)      // lists topics that work offline
    expect(askFn).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('internet "on" but server unreachable → offline-style reply, not a crash', async () => {
    const ask = vi.fn(async () => { throw Object.assign(new Error('x'), { code: 'NETWORK_ERROR' }) })
    const { run } = setup({ online: true, ask })
    const r = await run('Explain endometriosis')
    expect(r.source).toBe('offline')
    expect(r.reply).toMatch(/server|offline/i)
  })

  it('Gemini failure uses the server-provided safe fallback text', async () => {
    const ask = vi.fn(async () => { throw Object.assign(new Error('x'), { code: 'AI_UNAVAILABLE', data: { fallbackResponse: 'Assistant unavailable — call 112.' } }) })
    const { run } = setup({ online: true, ask })
    const r = await run('Explain endometriosis')
    expect(r).toMatchObject({ source: 'ai-error', reply: 'Assistant unavailable — call 112.' })
  })

  it('server-side safety replies (e.g. dosage) come back flagged', async () => {
    const ask = vi.fn(async () => ({ response: 'I cannot recommend doses', safety: { category: 'medication_dosage' } }))
    const { run } = setup({ online: true, ask })
    const r = await run('Explain endometriosis')
    expect(r.critical).toBe(true)
  })
})

describe('Hindi / Kannada routing', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); _resetConnectivity() })

  it('Hindi question → Hindi answer, offline', async () => {
    const { run, askFn } = setup({ online: false })
    const r = await run('पीरियड में दर्द', 'hi')
    expect(r).toMatchObject({ source: 'kb', lang: 'hi', translated: true })
    expect(r.reply).toMatch(/[\u0900-\u097F]/)
    expect(askFn).not.toHaveBeenCalled()
  })
  it('Kannada question → Kannada answer, offline', async () => {
    const { run } = setup({ online: false })
    const r = await run('ಮುಟ್ಟಿನ ನೋವಿಗೆ ಪರಿಹಾರ', 'kn')
    expect(r).toMatchObject({ source: 'kb', lang: 'kn' })
    expect(r.reply).toMatch(/[\u0C80-\u0CFF]/)
  })
  it('English rule match shown in the selected language when a translation exists (PCOS diet in Hindi UI)', async () => {
    const { run } = setup({ online: false })
    const r = await run('PCOS diet', 'hi')
    expect(r.lang).toBe('hi')
    expect(r.reply).toMatch(/[\u0900-\u097F]/)
  })
  it('Hindi emergency phrase is answered locally with emergency numbers', async () => {
    const { run, askFn } = setup({ online: true })
    const r = await run('मेरा पीछा कर रहा है कोई', 'hi')
    expect(r.critical).toBe(true)
    expect(r.reply).toMatch(/112/)
    expect(askFn).not.toHaveBeenCalled()
  })
  it('unknown Kannada question + internet sends the language to the backend', async () => {
    const { run, askFn } = setup({ online: true })
    await run('ಎಂಡೋಮೆಟ್ರಿಯೋಸಿಸ್ ಎಂದರೇನು', 'kn')
    expect(askFn.mock.calls[0][0].language).toBe('kn')
  })
  it('greeting is localised', async () => {
    const { run } = setup({ online: false })
    const r = await run('Hi', 'kn')
    expect(r.reply).toMatch(/ನಮಸ್ಕಾರ/)
  })
  it('the word "this" is not mistaken for the greeting "hi"', async () => {
    const { run } = setup({ online: false })
    const r = await run('Explain this condition please')
    expect(r.category).not.toBe('Greeting')
  })
})
