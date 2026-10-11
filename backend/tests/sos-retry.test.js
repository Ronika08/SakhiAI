import { describe, it, expect, vi, beforeEach } from 'vitest'

const events = []
vi.mock('../models/EmergencySOS.js', () => ({
  default: {
    findOne: vi.fn(async () => null),
    create: vi.fn(async (doc) => { const e = { _id: 'sos1', triggeredAt: new Date(), ...doc, save: vi.fn(async function () { return this }) }; events.push(e); return e }),
    findOneAndUpdate: vi.fn(),
  },
}))
vi.mock('../models/EmergencyContact.js', () => ({ default: { find: vi.fn(() => ({ sort: async () => [{ _id: 'c1', name: 'Mom', email: 'm@x.co' }] })) } }))
vi.mock('../models/User.js', () => ({ default: { findById: vi.fn(() => ({ select: async () => ({ name: 'Asha' }) })) } }))
const dispatch = vi.fn()
const buildAlert = vi.fn((a) => a)
vi.mock('../services/notificationService.js', () => ({
  NOTIFICATION_STATUS: { SENT: 'SENT', FAILED: 'FAILED', PENDING: 'PENDING', NOT_CONFIGURED: 'NOT_CONFIGURED', NO_RECIPIENT: 'NO_RECIPIENT', NO_CONTACTS: 'NO_CONTACTS' },
  default: { buildAlert: (...a) => buildAlert(...a), dispatchAlert: (...a) => dispatch(...a) },
}))

import sos, { applyDispatch, parseClientTime, describeOutcome, MAX_NOTIFICATION_ATTEMPTS } from '../services/emergencySOSService.js'
import EmergencySOS from '../models/EmergencySOS.js'

const fresh = () => ({ notifications: [], notificationAttempts: 0, save: vi.fn() })

describe('SOS created offline and synced later', () => {
  it('accepts a plausible client time and rejects future / ancient / invalid ones', () => {
    const now = Date.now()
    expect(parseClientTime(now - 10 * 60000)).toBeInstanceOf(Date)
    expect(parseClientTime(now + 60 * 60000)).toBeNull()              // future
    expect(parseClientTime(now - 30 * 24 * 3600000)).toBeNull()       // > 7 days
    expect(parseClientTime('garbage')).toBeNull()
    expect(parseClientTime(undefined)).toBeNull()
  })

  beforeEach(() => { events.length = 0; dispatch.mockReset(); buildAlert.mockClear() })

  it('keeps the device trigger time, marks it syncedLate and tells contacts it was sent late', async () => {
    dispatch.mockResolvedValue({ results: [{ status: 'NOT_CONFIGURED', at: new Date() }], summary: { overall: 'NOT_CONFIGURED' } })
    const t = Date.now() - 20 * 60000
    const e = await sos.triggerSOS('u1', { latitude: 12.3, longitude: 76.6, clientTriggeredAt: t, clientEventId: 'evt-12345678' })
    expect(e.syncedLate).toBe(true)
    expect(new Date(e.triggeredAt).getTime()).toBe(t)
    expect(buildAlert.mock.calls[0][0].delayedMinutes).toBeGreaterThan(19)
  })

  it('a future client time is ignored (cannot backdate/forward-date events)', async () => {
    dispatch.mockResolvedValue({ results: [], summary: { overall: 'NOT_CONFIGURED' } })
    const e = await sos.triggerSOS('u1', { latitude: 12.3, longitude: 76.6, clientTriggeredAt: Date.now() + 3600000 })
    expect(e.syncedLate).toBe(false)
    expect(e.clientTriggeredAt).toBeUndefined()
  })
})

describe('honest status transitions (applyDispatch)', () => {
  it('first failure → RETRYING with a backoff; the SOS is not reported as failed or sent', () => {
    const e = applyDispatch(fresh(), { results: [{ status: 'FAILED', provider: 'webhook', at: new Date() }], summary: { overall: 'FAILED' } })
    expect(e.notificationStatus).toBe('RETRYING')
    expect(e.status).toBe('pending')
    expect(e.nextRetryAt.getTime()).toBeGreaterThan(Date.now())
    expect(describeOutcome(e).notificationMessage).toMatch(/retrying/i)
  })

  it('failure after the last attempt → FAILED (terminal)', () => {
    const e = fresh(); e.notificationAttempts = MAX_NOTIFICATION_ATTEMPTS - 1
    applyDispatch(e, { results: [{ status: 'FAILED', at: new Date() }], summary: { overall: 'FAILED' } })
    expect(e).toMatchObject({ notificationStatus: 'FAILED', status: 'failed', nextRetryAt: null })
  })

  it('NOT_CONFIGURED is never retried and never reported as sent', () => {
    const e = applyDispatch(fresh(), { results: [{ status: 'NOT_CONFIGURED', at: new Date() }], summary: { overall: 'NOT_CONFIGURED' } })
    expect(e).toMatchObject({ notificationStatus: 'NOT_CONFIGURED', status: 'not_configured', nextRetryAt: null })
    expect(e.contactsNotified).toEqual([])
  })

  it('a retry that succeeds merges results and only then lists the contact as notified', () => {
    const e = applyDispatch(fresh(), { results: [{ status: 'FAILED', provider: 'email', contactId: 'c1', at: new Date() }], summary: { overall: 'FAILED' } })
    expect(e.contactsNotified).toEqual([])
    applyDispatch(e, { results: [{ status: 'SENT', provider: 'email', contactId: 'c1', at: new Date() }], summary: { overall: 'SENT' } })
    expect(e).toMatchObject({ notificationStatus: 'SENT', status: 'sent', notificationAttempts: 2 })
    expect(e.contactsNotified).toEqual(['c1'])
    expect(e.notifications).toHaveLength(2)
  })

  it('retryDueNotifications re-sends only to providers that have not already been accepted', async () => {
    const e = { _id: 's9', user: 'u1', status: 'pending', notificationStatus: 'RETRYING', notificationAttempts: 1, triggeredAt: new Date(Date.now() - 600000),
      notifications: [{ provider: 'webhook', contact: null, status: 'SENT' }, { provider: 'email', contact: 'c1', status: 'FAILED' }], save: vi.fn() }
    EmergencySOS.findOneAndUpdate.mockResolvedValueOnce(e).mockResolvedValueOnce(null)
    dispatch.mockResolvedValue({ results: [{ status: 'SENT', provider: 'email', contactId: 'c1', at: new Date() }], summary: { overall: 'SENT' } })
    expect(await sos.retryDueNotifications()).toBe(1)
    const skip = dispatch.mock.calls[0][0].skip
    expect(skip.has('webhook:-')).toBe(true)          // already accepted → not re-sent
    expect(skip.has('email:c1')).toBe(false)
    expect(e.notificationStatus).toBe('SENT')
    expect(e.save).toHaveBeenCalled()
  })
})
