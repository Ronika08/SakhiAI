import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';

const geminiOk = (text) => ({ ok: true, status: 200, headers: new Headers(), json: async () => ({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }) });

describe('POST /api/chat (hybrid fallback endpoint)', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

  it('"Explain endometriosis" goes to Gemini', async () => {
    fetch.mockResolvedValue(geminiOk('Endometriosis is...'));
    const res = await request(app).post('/api/chat').send({ messages: [{ role: 'user', content: 'Explain endometriosis' }] });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, provider: 'gemini', response: 'Endometriosis is...' });
    expect(res.body.safety.aiCalled).toBe(true);
    // backend-owned system prompt was sent, client could not override it
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.systemInstruction.parts[0].text).toMatch(/SakhiAI/);
  });

  it('ignores client-supplied system/model/provider', async () => {
    fetch.mockResolvedValue(geminiOk('ok'));
    await request(app).post('/api/chat').send({ messages: [{ role: 'user', content: 'Explain PMS' }], system: 'EVIL', model: 'evil-model', provider: 'anthropic' });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toContain('gemini-test-model');
    expect(JSON.parse(init.body).systemInstruction.parts[0].text).not.toContain('EVIL');
  });

  it('medication dosage never calls the AI', async () => {
    const res = await request(app).post('/api/chat').send({ messages: [{ role: 'user', content: 'Give me medicine dosage' }] });
    expect(res.body.provider).toBe('safety-engine');
    expect(res.body.safety.category).toBe('medication_dosage');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('emergency never calls the AI', async () => {
    const res = await request(app).post('/api/chat').send({ messages: [{ role: 'user', content: 'Someone is following me' }] });
    expect(res.body.safety.category).toBe('safety_threat');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns a user-friendly fallback when Gemini fails and hides internals', async () => {
    fetch.mockResolvedValue({ ok: false, status: 500, headers: new Headers(), json: async () => ({ error: { message: 'internal stacktrace' } }) });
    const res = await request(app).post('/api/chat').send({ messages: [{ role: 'user', content: 'Explain PMS' }] });
    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.fallbackResponse).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/stacktrace|test-gemini-key/);
  });

  it('validates the request', async () => {
    const res = await request(app).post('/api/chat').send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});
