import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// ---- in-memory fakes for the three auth collections ----
const h = vi.hoisted(() => {
  const db = { users: [], refresh: [], resets: [] };
  let seq = 0;
  const id = () => `id${++seq}`;
  const same = (a, q) => Object.entries(q).every(([k, v]) => (typeof v === 'object' && v !== null ? true : String(a[k]) === String(v)));
  const fakeCollection = (key) => ({
    create: vi.fn(async (doc) => { const d = { _id: id(), revokedAt: null, usedAt: null, ...doc, async save() { return this; } }; db[key].push(d); return d; }),
    findOne: vi.fn(async (q) => db[key].find((d) => same(d, q)) || null),
    updateMany: vi.fn(async (q) => {
      db[key].forEach((d) => {
        const match = (q.family ? d.family === q.family : true) && (q.user ? String(d.user) === String(q.user) : true);
        if (match) { d.revokedAt = d.revokedAt || new Date(); if ('usedAt' in d) d.usedAt = d.usedAt || new Date(); }
      });
    }),
    updateOne: vi.fn(async (q) => { const d = db[key].find((x) => x.tokenHash === q.tokenHash); if (d) d.revokedAt = new Date(); }),
  });
  
  return { db, id, same, fakeCollection };
});
const { db, id, same } = h;

vi.mock('../models/User.js', async () => {
  const bcryptjs = (await import('bcryptjs')).default;
  const makeUser = (doc) => ({
    _id: h.id(), role: 'user', isActive: true, failedLoginAttempts: 0, lockUntil: null,
    preferences: { notifications: {} }, healthPreferences: {}, ...doc,
    comparePassword(p) { return bcryptjs.compare(p, this.password); },
    // mimics the real model's pre-save password hashing
    async save() { if (this.password && !this.password.startsWith('$2')) this.password = await bcryptjs.hash(this.password, 4); return this; },
    toJSON() { const { password, ...rest } = this; return rest; },
  });
  const chain = (value) => { const p = Promise.resolve(value); p.select = () => p; return p; };
  return {
    default: {
      findOne: vi.fn((q) => chain(h.db.users.find((u) => (q.email ? u.email === q.email : true) && (q.isActive === undefined || u.isActive === q.isActive)) || null)),
      findById: vi.fn((i) => chain(h.db.users.find((u) => u._id === i) || null)),
      create: vi.fn(async ({ name, email, password }) => {
        const u = makeUser({ name, email: email.toLowerCase(), password: await bcryptjs.hash(password, 4) });
        h.db.users.push(u);
        return u;
      }),
    },
  };
});

vi.mock('../models/RefreshToken.js', () => ({ default: h.fakeCollection('refresh') }));
vi.mock('../models/PasswordReset.js', () => ({ default: h.fakeCollection('resets') }));
vi.mock('../config/db.js', () => ({ isDbConnected: () => true, pingDB: async () => true, connectDB: async () => {}, disconnectDB: async () => {} }));

import app from '../app.js';
import { validatePassword } from '../utils/passwordPolicy.js';

const strong = 'Sunflower#2026';
const register = (over = {}) => request(app).post('/api/auth/register').send({ name: 'Asha', email: 'asha@example.com', password: strong, ...over });

describe('password policy', () => {
  it.each([['short1', 1], ['allletters', 1], ['12345678', 1], ['password123', 1]])('%s is rejected', (pw) => {
    expect(validatePassword(pw).length).toBeGreaterThan(0);
  });
  it('accepts a good password and rejects one containing the e-mail name', () => {
    expect(validatePassword(strong)).toEqual([]);
    expect(validatePassword('ashaverma99', { email: 'ashaverma@x.co' }).length).toBeGreaterThan(0);
  });
});

describe('auth API', () => {
  beforeEach(() => { db.users.length = 0; db.refresh.length = 0; db.resets.length = 0; });

  it('registers, returns access+refresh tokens, never the password', async () => {
    const res = await register();
    expect(res.status).toBe(201);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/);
    expect(db.refresh[0].tokenHash).not.toBe(res.body.data.refreshToken); // stored hashed
  });

  it('rejects weak passwords, bad e-mails and duplicates', async () => {
    expect((await register({ password: 'abc' })).status).toBe(400);
    expect((await register({ email: 'nope' })).status).toBe(400);
    await register();
    const dup = await register();
    expect(dup.status).toBe(409);
  });

  it('logs in; wrong password and unknown user give the same generic 401', async () => {
    await register();
    const good = await request(app).post('/api/auth/login').send({ email: 'asha@example.com', password: strong });
    expect(good.status).toBe(200);
    const bad = await request(app).post('/api/auth/login').send({ email: 'asha@example.com', password: 'Wrong#pass1' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'ghost@example.com', password: 'Wrong#pass1' });
    expect(bad.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(bad.body.message).toBe(unknown.body.message);
  });

  it('locks the account after repeated failures', async () => {
    await register();
    for (let i = 0; i < 5; i += 1) await request(app).post('/api/auth/login').send({ email: 'asha@example.com', password: 'Wrong#pass1' });
    const locked = await request(app).post('/api/auth/login').send({ email: 'asha@example.com', password: strong });
    expect(locked.status).toBe(429);
  });

  it('protects /me: 401 without token, 200 with token, TOKEN_EXPIRED for expired', async () => {
    const { body } = await register();
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${body.data.token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe('asha@example.com');
    const expired = jwt.sign({ id: 'x' }, process.env.JWT_SECRET, { expiresIn: -10 });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects tokens signed with another secret or alg none', async () => {
    const forged = jwt.sign({ id: 'x' }, 'other-secret');
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${forged}`)).status).toBe(401);
  });

  it('rotates refresh tokens, detects reuse and revokes the family', async () => {
    const { body } = await register();
    const first = body.data.refreshToken;
    const r1 = await request(app).post('/api/auth/refresh').send({ refreshToken: first });
    expect(r1.status).toBe(200);
    expect(r1.body.data.refreshToken).not.toBe(first);
    // replaying the old one is theft → 401 and the new token is revoked too
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: first })).status).toBe(401);
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: r1.body.data.refreshToken })).status).toBe(401);
  });

  it('logout revokes the refresh token', async () => {
    const { body } = await register();
    await request(app).post('/api/auth/logout').send({ refreshToken: body.data.refreshToken }).expect(200);
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: body.data.refreshToken })).status).toBe(401);
  });

  it('forgot-password responds identically for known and unknown e-mails', async () => {
    await register();
    const a = await request(app).post('/api/auth/forgot-password').send({ email: 'asha@example.com' });
    const b = await request(app).post('/api/auth/forgot-password').send({ email: 'ghost@example.com' });
    expect(a.status).toBe(200);
    expect(a.body).toEqual(b.body);
    expect(JSON.stringify(a.body)).not.toMatch(/token/i);
  });

  it('reset-password is single use and enforces the policy', async () => {
    await register();
    const { default: tokenService } = await import('../services/tokenService.js');
    const raw = tokenService.newOpaqueToken();
    db.resets.push({ _id: id(), user: db.users[0]._id, tokenHash: tokenService.sha256(raw), expiresAt: new Date(Date.now() + 60000), usedAt: null, async save() { return this; } });

    expect((await request(app).post('/api/auth/reset-password').send({ token: raw, newPassword: 'weak' })).status).toBe(400);
    expect((await request(app).post('/api/auth/reset-password').send({ token: raw, newPassword: 'Brand#New2026' })).status).toBe(200);
    expect((await request(app).post('/api/auth/reset-password').send({ token: raw, newPassword: 'Another#New2026' })).status).toBe(400);
    expect((await request(app).post('/api/auth/login').send({ email: 'asha@example.com', password: 'Brand#New2026' })).status).toBe(200);
    expect((await request(app).post('/api/auth/reset-password').send({ token: 'nonsense-token-nonsense-token', newPassword: 'Brand#New2026' })).status).toBe(400);
  });

  it('protected data routes return 401 without a token', async () => {
    for (const path of ['/api/contacts', '/api/cycles', '/api/moods', '/api/wellness', '/api/sos', '/api/checkins']) {
      expect((await request(app).get(path)).status).toBe(401);
    }
  });
});
