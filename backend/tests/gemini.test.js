import { describe, it, expect, vi, beforeEach } from 'vitest';
import geminiService, { toGeminiContents, extractReply } from '../services/geminiService.js';

const ok = (text, extra = {}) => ({
  ok: true,
  status: 200,
  headers: new Headers(),
  json: async () => ({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP', ...extra }], usageMetadata: { totalTokenCount: 5 } }),
});
const fail = (status, body = {}) => ({ ok: false, status, headers: new Headers(), json: async () => body });
const msgs = [{ role: 'user', content: 'Explain endometriosis' }];

describe('geminiService', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

  it('returns the reply and uses the backend model, key in header (not URL)', async () => {
    fetch.mockResolvedValue(ok('Hello'));
    const r = await geminiService.generateResponse({ messages: msgs, model: 'attacker-model' });
    expect(r).toMatchObject({ reply: 'Hello', provider: 'gemini', model: 'gemini-test-model' });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toContain('gemini-test-model:generateContent');
    expect(url).not.toContain('attacker-model');
    expect(url).not.toContain('test-gemini-key');
    expect(init.headers['x-goog-api-key']).toBe('test-gemini-key');
  });

  it('maps 401/403 to AI_UNAVAILABLE without retrying', async () => {
    fetch.mockResolvedValue(fail(403, { error: { message: 'API key not valid' } }));
    await expect(geminiService.generateResponse({ messages: msgs })).rejects.toMatchObject({ code: 'AI_UNAVAILABLE', statusCode: 503 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to the fallback model on 404', async () => {
    fetch.mockResolvedValueOnce(fail(404, { error: { message: 'model not found' } })).mockResolvedValueOnce(ok('From fallback'));
    const r = await geminiService.generateResponse({ messages: msgs });
    expect(r.model).toBe('gemini-test-fallback');
    expect(fetch.mock.calls[1][0]).toContain('gemini-test-fallback');
  });

  it('reports AI_RATE_LIMITED when every model is rate limited', async () => {
    fetch.mockResolvedValue(fail(429, { error: { message: 'quota' } }));
    await expect(geminiService.generateResponse({ messages: msgs })).rejects.toMatchObject({ code: 'AI_RATE_LIMITED', statusCode: 429 });
  });

  it('retries transient 5xx once then succeeds', async () => {
    fetch.mockResolvedValueOnce(fail(503)).mockResolvedValueOnce(ok('Recovered'));
    const r = await geminiService.generateResponse({ messages: msgs });
    expect(r.reply).toBe('Recovered');
  });

  it('times out slow requests with AI_TIMEOUT', async () => {
    fetch.mockImplementation((url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('abort'), { name: 'AbortError' })))));
    await expect(geminiService.generateResponse({ messages: msgs })).rejects.toMatchObject({ code: 'AI_TIMEOUT' });
  });

  it('handles network errors', async () => {
    fetch.mockRejectedValue(new Error('ECONNRESET'));
    await expect(geminiService.generateResponse({ messages: msgs })).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
  });

  it('treats safety blocks as AI_BLOCKED', async () => {
    fetch.mockResolvedValue({ ok: true, status: 200, headers: new Headers(), json: async () => ({ promptFeedback: { blockReason: 'SAFETY' } }) });
    await expect(geminiService.generateResponse({ messages: msgs })).rejects.toMatchObject({ code: 'AI_BLOCKED' });
  });

  it('treats empty and malformed responses as AI_BAD_RESPONSE', async () => {
    fetch.mockResolvedValue({ ok: true, status: 200, headers: new Headers(), json: async () => ({}) });
    await expect(geminiService.generateResponse({ messages: msgs })).rejects.toMatchObject({ code: 'AI_BAD_RESPONSE' });
    fetch.mockResolvedValue({ ok: true, status: 200, headers: new Headers(), json: async () => { throw new Error('bad json'); } });
    await expect(geminiService.generateResponse({ messages: msgs })).rejects.toBeTruthy();
  });

  it('never leaks provider error text', async () => {
    fetch.mockResolvedValue(fail(500, { error: { message: 'SECRET INTERNAL DETAIL' } }));
    const err = await geminiService.generateResponse({ messages: msgs }).catch((e) => e);
    expect(err.message).not.toContain('SECRET');
  });
});

describe('toGeminiContents / extractReply', () => {
  it('merges same-role turns, drops empties, starts with user', () => {
    const c = toGeminiContents([
      { role: 'assistant', content: 'hi' },
      { role: 'user', content: 'a' },
      { role: 'user', content: 'b' },
      { role: 'assistant', content: '  ' },
    ]);
    expect(c).toHaveLength(1);
    expect(c[0].parts[0].text).toBe('a\n\nb');
  });
  it('ignores thought parts', () => {
    const r = extractReply({ candidates: [{ content: { parts: [{ text: 'thinking', thought: true }, { text: 'answer' }] }, finishReason: 'STOP' }] }, 'm');
    expect(r.reply).toBe('answer');
  });
});
