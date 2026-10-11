import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = { events: [] };
vi.mock('../models/EmergencySOS.js', () => ({
  default: {
    findOne: vi.fn(async () => null),
    create: vi.fn(async (doc) => {
      const e = { _id: 'sos1', triggeredAt: new Date(), ...doc, save: vi.fn(async function () { return this; }) };
      store.events.push(e);
      return e;
    }),
  },
}));
vi.mock('../models/EmergencyContact.js', () => ({
  default: { find: vi.fn(() => ({ sort: async () => [{ _id: 'c1', name: 'Mom', phone: '+911234567890', email: 'mom@example.com' }] })) },
}));
vi.mock('../models/User.js', () => ({ default: { findById: vi.fn(() => ({ select: async () => ({ name: 'Asha' }) })) } }));

const dispatch = vi.fn();
vi.mock('../services/notificationService.js', () => ({
  NOTIFICATION_STATUS: { SENT: 'SENT', FAILED: 'FAILED', PENDING: 'PENDING', NOT_CONFIGURED: 'NOT_CONFIGURED', NO_RECIPIENT: 'NO_RECIPIENT', NO_CONTACTS: 'NO_CONTACTS' },
  default: { buildAlert: vi.fn((a) => a), dispatchAlert: (...args) => dispatch(...args) },
}));

import sosService, { classifyAccuracy, describeOutcome } from '../services/emergencySOSService.js';

describe('SOS service never over-claims', () => {
  beforeEach(() => { store.events.length = 0; dispatch.mockReset(); });

  it('NOT_CONFIGURED -> status not_configured and no contacts marked notified', async () => {
    dispatch.mockResolvedValue({ results: [{ status: 'NOT_CONFIGURED', detail: 'x', at: new Date() }], summary: { overall: 'NOT_CONFIGURED' } });
    const e = await sosService.triggerSOS('u1', { latitude: 12.3, longitude: 76.6, accuracy: 20 });
    expect(e.status).toBe('not_configured');
    expect(e.notificationStatus).toBe('NOT_CONFIGURED');
    expect(e.contactsNotified).toEqual([]);
    expect(describeOutcome(e).notificationMessage).toMatch(/NO contact was notified/);
  });

  it('only contacts with a SENT result are listed as notified', async () => {
    dispatch.mockResolvedValue({
      results: [
        { contactId: 'c1', status: 'SENT', at: new Date() },
        { contactId: 'c2', status: 'FAILED', at: new Date() },
      ],
      summary: { overall: 'SENT' },
    });
    const e = await sosService.triggerSOS('u1', { latitude: 12.3, longitude: 76.6 });
    expect(e.status).toBe('sent');
    expect(e.contactsNotified).toEqual(['c1']);
  });

  it('first failure -> RETRYING (pending): never "sent", not yet terminal "failed"', async () => {
    dispatch.mockResolvedValue({ results: [{ status: 'FAILED', at: new Date() }], summary: { overall: 'FAILED' } });
    const e = await sosService.triggerSOS('u1', { latitude: 12.3, longitude: 76.6 });
    expect(e.notificationStatus).toBe('RETRYING');
    expect(e.status).toBe('pending');
    expect(e.contactsNotified).toEqual([]);
  });

  it('dispatch crash is recorded as RETRYING (not sent); nobody is listed as notified', async () => {
    dispatch.mockRejectedValue(new Error('boom'));
    const e = await sosService.triggerSOS('u1', { latitude: 12.3, longitude: 76.6 });
    expect(e.notificationStatus).toBe('RETRYING');
    expect(e.status).not.toBe('sent');
    expect(e.contactsNotified).toEqual([]);
  });

  it('records an SOS without GPS (location unavailable) instead of blocking it', async () => {
    dispatch.mockResolvedValue({ results: [], summary: { overall: 'NOT_CONFIGURED' } });
    const e = await sosService.triggerSOS('u1', {});
    expect(e.locationAvailable).toBe(false);
    expect(e.locationUrl).toBeNull();
  });

  it('classifies GPS accuracy', () => {
    expect(classifyAccuracy(30)).toBe('good');
    expect(classifyAccuracy(500)).toBe('low');
    expect(classifyAccuracy(5000)).toBe('poor');
    expect(classifyAccuracy(undefined)).toBe('unknown');
  });
});
