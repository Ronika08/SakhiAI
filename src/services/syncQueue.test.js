import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Q from './syncQueue'
import { _resetConnectivity, reportNetworkSuccess } from './connectivity'

const authed = () => true
const setOnline = (v) => vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(v)

describe('offline write queue (outbox)', () => {
  beforeEach(() => { Q._resetSyncQueue(); _resetConnectivity(); vi.restoreAllMocks(); setOnline(true); reportNetworkSuccess() })

  it('signed-in + online: sends immediately and leaves nothing queued', async () => {
    const handler = vi.fn(async () => ({ ok: 1 }))
    Q.registerHandlers({ 'mood.save': handler })
    const r = await Q.submit('mood.save', { emoji: '😊' }, { isAuthed: authed })
    expect(r.status).toBe('done')
    expect(handler).toHaveBeenCalledTimes(1)
    expect(Q.listOutbox()).toHaveLength(0)
  })

  it('offline: local change is KEPT in the queue, nothing is sent', async () => {
    setOnline(false)
    const handler = vi.fn()
    Q.registerHandlers({ 'mood.save': handler })
    const r = await Q.submit('mood.save', { emoji: '😊' }, { isAuthed: authed })
    expect(r.status).toBe('queued')
    expect(handler).not.toHaveBeenCalled()
    expect(Q.listOutbox()).toHaveLength(1)
  })

  it('anonymous: queued but never sent (until the user signs in)', async () => {
    const handler = vi.fn()
    Q.registerHandlers({ 'mood.save': handler })
    const r = await Q.submit('mood.save', {}, { isAuthed: () => false })
    expect(r.status).toBe('queued')
    expect(handler).not.toHaveBeenCalled()
  })

  it('queued changes are synced once connectivity returns — and survive a reload', async () => {
    setOnline(false)
    const handler = vi.fn(async () => ({}))
    Q.registerHandlers({ 'wellness.save': handler })
    await Q.submit('wellness.save', { date: '2026-10-08', water: 5 }, { key: 'w', isAuthed: authed })
    expect(JSON.parse(localStorage.getItem(Q.OUTBOX_KEY))).toHaveLength(1)   // persisted
    setOnline(true)
    const res = await Q.flush({ isAuthed: authed })
    expect(res).toMatchObject({ processed: 1, remaining: 0 })
    expect(handler).toHaveBeenCalledWith({ date: '2026-10-08', water: 5 }, expect.any(Object))
  })

  it('network failure keeps the operation (data is never lost) and stops hammering', async () => {
    const handler = vi.fn(async () => { throw Object.assign(new Error('x'), { code: 'NETWORK_ERROR' }) })
    Q.registerHandlers({ 'a': handler, 'b': handler })
    Q.enqueue('a', {}); Q.enqueue('b', {})
    const res = await Q.flush({ isAuthed: authed })
    expect(res.remaining).toBe(2)
    expect(handler).toHaveBeenCalledTimes(1)               // stopped after the first network failure
    expect(Q.listOutbox()[0].attempts).toBe(1)
  })

  it('server 5xx / 429 / expired token keep the op; validation errors drop it and report', async () => {
    const results = []
    Q.onOpResult((e) => results.push(e))
    Q.registerHandlers({
      five: async () => { throw Object.assign(new Error('x'), { status: 503 }) },
      rate: async () => { throw Object.assign(new Error('x'), { status: 429 }) },
      bad: async () => { throw Object.assign(new Error('x'), { status: 400, code: 'VALIDATION_ERROR' }) },
    })
    Q.enqueue('bad', {})
    await Q.flush({ isAuthed: authed })
    expect(Q.listOutbox()).toHaveLength(0)
    expect(results.at(-1)).toMatchObject({ ok: false, permanent: true })

    Q.enqueue('rate', {})
    await Q.flush({ isAuthed: authed })
    expect(Q.listOutbox()).toHaveLength(1)                 // 429 → retry later

    Q.clearOutbox(); Q.enqueue('five', {})
    await Q.flush({ isAuthed: authed })
    expect(Q.listOutbox()).toHaveLength(1)                 // 503 → retry later
  })

  it('coalesces operations with the same key (latest wins)', () => {
    Q.enqueue('wellness.save', { water: 1 }, { key: 'wellness:d' })
    Q.enqueue('wellness.save', { water: 2 }, { key: 'wellness:d' })
    Q.enqueue('wellness.save', { water: 3 }, { key: 'wellness:d' })
    const ops = Q.listOutbox()
    expect(ops).toHaveLength(1)
    expect(ops[0].payload.water).toBe(3)
  })

  it('removeByKey drops a never-synced operation', () => {
    Q.enqueue('cycle.save', {}, { key: 'cycle:2026-10-01' })
    expect(Q.removeByKey('cycle:2026-10-01')).toBe(true)
    expect(Q.listOutbox()).toHaveLength(0)
  })

  it('SOS (critical) is sent before older, non-critical changes', async () => {
    const order = []
    Q.registerHandlers({ 'mood.save': async () => order.push('mood'), 'sos.create': async () => order.push('sos') })
    Q.enqueue('mood.save', {})
    Q.enqueue('sos.create', {}, { critical: true })
    await Q.flush({ isAuthed: authed })
    expect(order).toEqual(['sos', 'mood'])
  })

  it('flush is single-flight and a no-op while offline or signed out', async () => {
    const h = vi.fn(async () => ({}))
    Q.registerHandlers({ x: h })
    Q.enqueue('x', {})
    setOnline(false)
    expect((await Q.flush({ isAuthed: authed })).processed).toBe(0)
    setOnline(true)
    expect((await Q.flush({ isAuthed: () => false })).processed).toBe(0)
    expect(h).not.toHaveBeenCalled()
    const [a, b] = await Promise.all([Q.flush({ isAuthed: authed }), Q.flush({ isAuthed: authed })])
    expect(a.processed + b.processed).toBe(1)
    expect(h).toHaveBeenCalledTimes(1)
  })

  it('an operation without a registered handler is discarded as permanent (no infinite retry)', async () => {
    Q.enqueue('unknown.type', {})
    const res = await Q.flush({ isAuthed: authed })
    expect(res.remaining).toBe(0)
    expect(res.failed).toBe(1)
  })

  it('reports queue changes to subscribers', async () => {
    const seen = []
    Q.onOutboxChange((s) => seen.push(s.pending))
    Q.enqueue('x', {}); Q.enqueue('y', {})
    expect(seen.at(-1)).toBe(2)
  })

  it('isRetryable classification', () => {
    expect(Q.isRetryable({ code: 'TIMEOUT' })).toBe(true)
    expect(Q.isRetryable({ status: 500 })).toBe(true)
    expect(Q.isRetryable({ status: 401 })).toBe(true)
    expect(Q.isRetryable({ status: 400 })).toBe(false)
    expect(Q.isRetryable({ status: 404 })).toBe(false)
  })
})
