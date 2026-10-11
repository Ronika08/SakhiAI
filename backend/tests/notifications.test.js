import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks for DB-backed pieces used by the Web Push provider.
vi.mock('../models/PushSubscription.js', () => ({ default: { find: vi.fn().mockResolvedValue([]), deleteOne: vi.fn() } }));
vi.mock('../models/User.js', () => ({ default: { findOne: vi.fn().mockResolvedValue(null), findById: vi.fn() } }));

const loadWith = async (env) => {
  vi.resetModules();
  Object.assign(process.env, env);
  return import('../services/notificationService.js');
};

const contacts = [
  { _id: 'c1', name: 'Mom', phone: '+911234567890', email: 'mom@example.com' },
  { _id: 'c2', name: 'Friend', phone: '+919876543210', email: null },
];

describe('notificationService honesty', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    for (const k of ['NOTIFY_WEBHOOK_URLS', 'RESEND_API_KEY', 'EMAIL_FROM', 'SMTP_HOST', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT']) process.env[k] = '';
  });

  it('reports NOT_CONFIGURED and sends nothing when no provider is configured', async () => {
    const svc = await loadWith({});
    const alert = svc.buildAlert({ type: 'sos', userName: 'Asha', latitude: 12.3, longitude: 76.6, locationUrl: 'https://www.google.com/maps?q=12.3,76.6' });
    const { results, summary } = await svc.dispatchAlert({ userId: 'u1', contacts, alert });
    expect(summary.overall).toBe('NOT_CONFIGURED');
    expect(summary.sent).toBe(0);
    expect(results.every((r) => r.status !== 'SENT')).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('webhook 2xx -> SENT (accepted, not "delivered")', async () => {
    fetch.mockResolvedValue({ ok: true, status: 200 });
    const svc = await loadWith({ NOTIFY_WEBHOOK_URLS: 'https://ntfy.sh/sakhi-test', NOTIFY_WEBHOOK_SECRET: 's3cret' });
    const alert = svc.buildAlert({ type: 'sos', userName: 'Asha' });
    const { summary, results } = await svc.dispatchAlert({ userId: 'u1', contacts, alert });
    expect(summary.overall).toBe('SENT');
    expect(results[0].detail).toMatch(/not that a person has read/);
    expect(fetch.mock.calls[0][1].headers['X-SakhiAI-Signature']).toMatch(/^[a-f0-9]{64}$/);
  });

  it('webhook failure -> FAILED, never SENT', async () => {
    fetch.mockResolvedValue({ ok: false, status: 500 });
    const svc = await loadWith({ NOTIFY_WEBHOOK_URLS: 'https://example.com/hook' });
    const { summary } = await svc.dispatchAlert({ userId: 'u1', contacts, alert: svc.buildAlert({ type: 'sos' }) });
    expect(summary.overall).toBe('FAILED');
  });

  it('rejects non-https webhook URLs in the configured list', async () => {
    const svc = await loadWith({ NOTIFY_WEBHOOK_URLS: 'ftp://x.example, javascript:alert(1)' });
    expect(svc.getChannelStatus().webhook).toBe(false);
  });

  it('web push with no subscriptions -> NO_RECIPIENT, not SENT', async () => {
    const svc = await loadWith({ VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv', VAPID_SUBJECT: 'mailto:a@b.co' });
    const { summary, results } = await svc.dispatchAlert({ userId: 'u1', contacts, alert: svc.buildAlert({ type: 'sos' }) });
    expect(summary.overall).toBe('NO_RECIPIENT');
    expect(results.every((r) => r.status === 'NO_RECIPIENT')).toBe(true);
  });

  it('email provider skips contacts without an e-mail address', async () => {
    fetch.mockResolvedValue({ ok: true, status: 200 });
    const svc = await loadWith({ RESEND_API_KEY: 'test-resend-key', EMAIL_FROM: 'sos@example.com' });
    const { results, summary } = await svc.dispatchAlert({ userId: 'u1', contacts, alert: svc.buildAlert({ type: 'sos', userName: 'Asha' }) });
    expect(results.find((r) => r.contactName === 'Mom').status).toBe('SENT');
    expect(results.find((r) => r.contactName === 'Friend').status).toBe('NO_RECIPIENT');
    expect(summary.overall).toBe('SENT');
  });

  it('a provider that throws is reported FAILED, not crashed', async () => {
    fetch.mockRejectedValue(new Error('boom'));
    const svc = await loadWith({ NOTIFY_WEBHOOK_URLS: 'https://example.com/hook' });
    const { summary } = await svc.dispatchAlert({ userId: 'u1', contacts, alert: svc.buildAlert({ type: 'sos' }) });
    expect(summary.overall).toBe('FAILED');
  });

  it('escapes HTML in alert e-mails', async () => {
    const svc = await loadWith({});
    const a = svc.buildAlert({ type: 'sos', userName: '<b>x</b>', message: '<script>alert(1)</script>' });
    expect(a.html).not.toContain('<script>');
  });
});
