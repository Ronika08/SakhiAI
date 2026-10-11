/**
 * services/syncQueue.js
 *
 * OFFLINE-FIRST WRITE QUEUE ("outbox").
 *
 *   local change ─► localStorage (always, by the app)  +  outbox operation
 *        │
 *        ├─ signed in AND online ─► run now ─► MongoDB (via the API)
 *        └─ offline / server down / signed out ─► stays queued
 *                                                    │ connectivity returns / sign-in
 *                                                    ▼
 *                                          flush: oldest-first, SOS first
 *
 * Guarantees
 *  - Nothing the user created is dropped because of a temporary failure:
 *    network errors, timeouts, 5xx, 429 and 401 (needs sign-in) keep the op.
 *  - Only permanent client errors (4xx validation etc.) discard an op, and the
 *    failure is reported to the UI instead of being silent.
 *  - Operations carry idempotency keys (clientId / clientEventId / per-day
 *    upserts) so a replay after a half-finished request never duplicates data.
 *  - Ops with the same `key` are coalesced (latest wins), e.g. editing today's
 *    wellness three times offline syncs once.
 *  - The queue survives reloads (localStorage) and is shared by all features.
 *
 * Handlers are registered by services/syncHandlers.js; this module has no
 * knowledge of specific endpoints, so it is generic and unit-testable.
 */
import { subscribeConnectivity, isOnline, reportNetworkFailure, reportNetworkSuccess } from './connectivity'

export const OUTBOX_KEY = 'sakhi_outbox_v1'
const MAX_OPS = 500

let handlers = {}
let flushing = false
const changeListeners = new Set()
const resultListeners = new Set()
let timer = null

const read = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch { return [] }
}
const write = (ops) => {
  try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(ops.slice(-MAX_OPS))) } catch { /* storage full/unavailable */ }
  changeListeners.forEach((fn) => { try { fn(summary(ops)) } catch { /* ignore */ } })
}

const summary = (ops = read()) => ({
  pending: ops.length,
  critical: ops.filter((o) => o.critical).length,
  syncing: flushing,
})

const newId = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`)

export function registerHandlers(map) { handlers = { ...handlers, ...map } }
export const getOutboxSummary = () => summary()
export const listOutbox = () => read()
export function onOutboxChange(fn) { changeListeners.add(fn); return () => changeListeners.delete(fn) }
/** Listener receives { op, ok, result?, error?, permanent? } for every processed operation. */
export function onOpResult(fn) { resultListeners.add(fn); return () => resultListeners.delete(fn) }
const emit = (evt) => resultListeners.forEach((fn) => { try { fn(evt) } catch { /* ignore */ } })

/** Adds an operation. Same `key` replaces the older queued op (latest wins). */
export function enqueue(type, payload, { key, critical = false } = {}) {
  let ops = read()
  if (key) ops = ops.filter((o) => o.key !== key)
  const op = { id: newId(), type, payload, key: key || null, critical, createdAt: Date.now(), attempts: 0, lastError: null }
  ops.push(op)
  write(ops)
  return op
}

export function removeByKey(key) {
  const ops = read()
  const next = ops.filter((o) => o.key !== key)
  if (next.length !== ops.length) write(next)
  return next.length !== ops.length
}
export function removeOp(id) { write(read().filter((o) => o.id !== id)) }
export function clearOutbox() { write([]) }

/** Errors that mean "try again later" — the op must be kept. */
export function isRetryable(err) {
  if (!err) return false
  if (['NETWORK_ERROR', 'NETWORK_OFFLINE', 'TIMEOUT'].includes(err.code)) return true
  const s = err.status
  if (!s) return true                 // unknown / no HTTP status → assume transient
  return s >= 500 || s === 429 || s === 408 || s === 401 || s === 403 && err.code === 'TOKEN_EXPIRED'
}

async function runOp(op) {
  const handler = handlers[op.type]
  if (!handler) throw Object.assign(new Error(`No handler for ${op.type}`), { permanent: true })
  return handler(op.payload, op)
}

/**
 * Flushes the queue. Safe to call often (single-flight).
 * @param {{ isAuthed: () => boolean }} ctx
 * @returns {Promise<{ processed: number, remaining: number, failed: number }>}
 */
export async function flush({ isAuthed = () => false } = {}) {
  if (flushing) return { processed: 0, remaining: read().length, failed: 0 }
  if (!isAuthed() || !isOnline()) return { processed: 0, remaining: read().length, failed: 0 }

  flushing = true
  write(read()) // notify "syncing"
  let processed = 0
  let failed = 0

  try {
    // SOS first, then oldest-first.
    const queue = [...read()].sort((a, b) => Number(b.critical) - Number(a.critical) || a.createdAt - b.createdAt)
    for (const op of queue) {
      if (!isAuthed()) break
      try {
        const result = await runOp(op)
        reportNetworkSuccess()
        write(read().filter((o) => o.id !== op.id))
        processed += 1
        emit({ op, ok: true, result })
      } catch (err) {
        if (isRetryable(err) && !err.permanent) {
          if (['NETWORK_ERROR', 'NETWORK_OFFLINE', 'TIMEOUT'].includes(err.code)) reportNetworkFailure()
          write(read().map((o) => (o.id === op.id ? { ...o, attempts: o.attempts + 1, lastError: err.code || 'ERROR' } : o)))
          emit({ op, ok: false, error: err, permanent: false })
          // Connection problems: stop and retry later instead of hammering.
          if (['NETWORK_ERROR', 'NETWORK_OFFLINE', 'TIMEOUT'].includes(err.code) || err.status >= 500) break
        } else {
          write(read().filter((o) => o.id !== op.id))
          failed += 1
          emit({ op, ok: false, error: err, permanent: true })
        }
      }
    }
  } finally {
    flushing = false
    write(read())
  }
  return { processed, remaining: read().length, failed }
}

/**
 * Records a change. If the user is signed in and online it is sent right away;
 * otherwise it stays queued and is synced later.
 * @returns {Promise<{ status: 'done'|'queued'|'failed', result?: any, op: object }>}
 */
export async function submit(type, payload, { key, critical = false, isAuthed = () => false } = {}) {
  const op = enqueue(type, payload, { key, critical })
  if (!isAuthed()) return { status: 'queued', op }
  if (!isOnline()) return { status: 'queued', op }
  const before = new Set()
  const unsub = onOpResult((e) => { if (e.op.id === op.id) before.add(e) })
  await flush({ isAuthed })
  unsub()
  const evt = [...before][0]
  if (evt?.ok) return { status: 'done', result: evt.result, op }
  if (evt && evt.permanent) return { status: 'failed', error: evt.error, op }
  return { status: 'queued', op }
}

/** Starts background syncing: on reconnect, on an interval, and on demand. Returns cleanup. */
export function startSyncEngine({ isAuthed }) {
  const run = () => { flush({ isAuthed }) }
  const unsub = subscribeConnectivity((s) => { if (s === 'online') run() })
  const onOnline = () => run()
  const onVisible = () => { if (document.visibilityState === 'visible') run() }
  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisible)
  const schedule = () => {
    timer = setTimeout(() => { run(); schedule() }, getOutboxSummary().critical ? 15000 : 60000)
  }
  schedule()
  run()
  return () => {
    unsub()
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisible)
    clearTimeout(timer)
  }
}

/** Test helper. */
export function _resetSyncQueue() {
  handlers = {}
  flushing = false
  changeListeners.clear()
  resultListeners.clear()
  clearTimeout(timer)
  try { localStorage.removeItem(OUTBOX_KEY) } catch { /* ignore */ }
}
