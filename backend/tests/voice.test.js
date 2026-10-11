import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

const audio = Buffer.alloc(300, 1).toString('base64')
const ok = (text) => ({ ok: true, status: 200, headers: new Headers(), json: async () => ({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }) })

async function loadApp(env) {
  vi.resetModules()
  // Re-importing the app re-registers Mongoose models; clear them first.
  const mongoose = (await import('mongoose')).default
  Object.keys(mongoose.models).forEach((m) => mongoose.deleteModel(m))
  Object.assign(process.env, env)
  return (await import('../app.js')).default
}

describe('optional online speech-to-text fallback', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))

  it('is OFF by default: status says disabled and transcribe is refused without contacting any service', async () => {
    const app = await loadApp({ VOICE_STT_ENABLED: '' })
    expect((await request(app).get('/api/voice/status')).body.data.serverSttEnabled).toBe(false)
    const res = await request(app).post('/api/voice/transcribe').send({ audioBase64: audio, mimeType: 'audio/webm' })
    expect(res.status).toBe(503)
    expect(fetch).not.toHaveBeenCalled()
  })

  describe('when explicitly enabled', () => {
    let app
    beforeEach(async () => { app = await loadApp({ VOICE_STT_ENABLED: 'true', VOICE_MAX_AUDIO_BYTES: '1000' }); fetch.mockReset() })

    it('transcribes through Gemini using the backend-owned model and key (header only)', async () => {
      fetch.mockResolvedValue(ok('period pain'))
      const res = await request(app).post('/api/voice/transcribe').send({ audioBase64: audio, mimeType: 'audio/webm;codecs=opus', language: 'kn' })
      expect(res.status).toBe(200)
      expect(res.body.data.text).toBe('period pain')
      const [url, init] = fetch.mock.calls[0]
      expect(url).toContain('gemini-test-model')
      expect(url).not.toContain('test-gemini-key')
      expect(init.headers['x-goog-api-key']).toBe('test-gemini-key')
      const body = JSON.parse(init.body)
      expect(body.contents[0].parts[0].inlineData.mimeType).toBe('audio/webm')
      expect(body.contents[0].parts[1].text).toMatch(/Kannada/)
    })

    it('validates audio type, base64 and size', async () => {
      expect((await request(app).post('/api/voice/transcribe').send({ audioBase64: audio, mimeType: 'text/html' })).status).toBe(400)
      expect((await request(app).post('/api/voice/transcribe').send({ audioBase64: '<script>', mimeType: 'audio/webm' })).status).toBe(400)
      expect((await request(app).post('/api/voice/transcribe').send({ mimeType: 'audio/webm' })).status).toBe(400)
      const big = Buffer.alloc(5000, 1).toString('base64')
      expect((await request(app).post('/api/voice/transcribe').send({ audioBase64: big, mimeType: 'audio/webm' })).status).toBe(413)
      expect(fetch).not.toHaveBeenCalled()
    })

    it('returns a safe error when Gemini fails (no provider text)', async () => {
      fetch.mockResolvedValue({ ok: false, status: 500, headers: new Headers(), json: async () => ({ error: { message: 'SECRET' } }) })
      const res = await request(app).post('/api/voice/transcribe').send({ audioBase64: audio, mimeType: 'audio/webm' })
      expect(res.status).toBeGreaterThanOrEqual(500)
      expect(JSON.stringify(res.body)).not.toMatch(/SECRET|test-gemini-key/)
    })
  })
})
