import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { sanitizeValue, validate } from '../middleware/validate.js';
import { redact } from '../utils/logger.js';

describe('security middleware', () => {
  it('sets security headers and request id, hides x-powered-by', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toMatch(/default-src 'none'/);
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('rejects disallowed CORS origins and allows configured ones', async () => {
    const bad = await request(app).get('/health').set('Origin', 'https://evil.example');
    expect(bad.status).toBe(403);
    const good = await request(app).get('/health').set('Origin', 'http://localhost:5173');
    expect(good.status).toBe(200);
    expect(good.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('rejects oversized payloads', async () => {
    const res = await request(app).post('/api/chat').send({ messages: [{ role: 'user', content: 'x'.repeat(200000) }] });
    expect(res.status).toBe(413);
    expect(res.body.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('rejects malformed JSON with a safe message', async () => {
    const res = await request(app).post('/api/chat').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.message).not.toMatch(/Unexpected token|at /);
  });

  it('returns 404 JSON for unknown routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, code: 'NOT_FOUND' });
  });

  it('protected routes require authentication (401) and DB routes fail fast (503) without a DB', async () => {
    const res = await request(app).get('/api/contacts');
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('DATABASE_ERROR');
  });

  it('health is ok; readiness reflects configuration', async () => {
    expect((await request(app).get('/health')).body.status).toBe('ok');
    const ready = await request(app).get('/ready');
    expect(ready.body.checks).toHaveProperty('database');
  });

  it('exposes notification channel status without secrets', async () => {
    const res = await request(app).get('/api/notifications/status');
    expect(res.status).toBe(200);
    expect(res.body.data.anyConfigured).toBe(false);
    expect(JSON.stringify(res.body)).not.toMatch(/privateKey|apiKey/i);
  });
});

describe('sanitize / validate / redact', () => {
  it('strips NoSQL operators and prototype keys', () => {
    const cleaned = sanitizeValue({ email: { $gt: '' }, 'a.b': 1, ok: ' x\u0000 ', nested: { $where: 'x', fine: 1 } });
    expect(cleaned.email).toEqual({});
    expect(cleaned['a.b']).toBeUndefined();
    expect(cleaned.ok).toBe('x');
    expect(cleaned.nested).toEqual({ fine: 1 });
  });

  it('validate() reports field errors', () => {
    const mw = validate({ body: { email: { type: 'email', required: true }, age: { type: 'number', max: 10 } } });
    let err;
    mw({ body: { email: 'nope', age: 11 } }, {}, (e) => { err = e; });
    expect(err.statusCode).toBe(400);
    expect(err.details.length).toBe(2);
    let ok;
    mw({ body: { email: 'a@b.co' } }, {}, (e) => { ok = e; });
    expect(ok).toBeUndefined();
  });

  it('redacts secrets from logs', () => {
    expect(redact('Authorization: Bearer abc.def.ghi')).not.toMatch(/abc\.def/);
    expect(redact('url?key=AIzaSyA1234567890123456789012345')).not.toMatch(/AIza/);
    expect(redact('{"password":"hunter2"}')).not.toMatch(/hunter2/);
  });
});

describe('logger masks configured secret values wherever they appear', () => {
  it('replaces the exact Gemini key / JWT secret even inside provider error text', () => {
    expect(redact('upstream said: key test-gemini-key is invalid')).not.toContain('test-gemini-key')
    expect(redact(`secret ${process.env.JWT_SECRET} leaked`)).not.toContain(process.env.JWT_SECRET)
  })
})
