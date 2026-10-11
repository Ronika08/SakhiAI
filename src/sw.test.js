import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { resolve } from 'node:path'

/**
 * Runs public/sw.js in a sandbox with fake caches/fetch to prove the offline
 * behaviour without a browser: precaching, offline navigation, asset caching and
 * — critically — that /api and cross-origin requests are never intercepted.
 */
const source = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8')

function makeEnv({ network = true, manifest = { urls: ['/', '/offline.html', '/assets/app.js'] } } = {}) {
  const store = new Map()   // cacheName → Map(url → Response-like)
  const listeners = {}
  const respond = (body, ok = true) => ({ ok, status: ok ? 200 : 500, body, clone() { return this }, json: async () => JSON.parse(body) })
  const state = { network }
  const fetchMock = vi.fn(async (req) => {
    const url = typeof req === 'string' ? req : req.url
    if (!state.network) throw new TypeError('offline')
    if (url.endsWith('precache-manifest.json')) return respond(JSON.stringify(manifest))
    return respond(`net:${url}`)
  })
  const open = async (name) => {
    if (!store.has(name)) store.set(name, new Map())
    const m = store.get(name)
    return { put: async (k, v) => m.set(typeof k === 'string' ? k : k.url, v), match: async (k) => m.get(typeof k === 'string' ? k : k.url) }
  }
  const caches = {
    open,
    keys: async () => [...store.keys()],
    delete: async (k) => store.delete(k),
    match: async (req) => { for (const m of store.values()) { const v = m.get(typeof req === 'string' ? req : req.url) ?? m.get(new URL(typeof req === 'string' ? req : req.url, 'https://app.test').pathname); if (v) return v } return undefined },
  }
  const self = {
    location: { origin: 'https://app.test' },
    addEventListener: (t, fn) => { listeners[t] = fn },
    skipWaiting: vi.fn(async () => {}),
    clients: { claim: vi.fn(async () => {}), matchAll: async () => [], openWindow: vi.fn() },
    registration: { showNotification: vi.fn() },
  }
  const ctx = { self, caches, fetch: fetchMock, URL, Response: { error: () => ({ error: true }) }, Promise, Array, JSON, setTimeout, clearTimeout, Error, console }
  runInNewContext(source, ctx)
  const dispatch = async (type, extra = {}) => {
    let p
    listeners[type]({ waitUntil: (x) => { p = x }, respondWith: (x) => { p = x }, ...extra })
    return p
  }
  return { store, state, fetchMock, dispatch, self, listeners }
}

const navReq = (path) => ({ method: 'GET', mode: 'navigate', url: `https://app.test${path}` })
const assetReq = (path) => ({ method: 'GET', mode: 'cors', url: `https://app.test${path}` })

describe('service worker (offline shell)', () => {
  it('install precaches every file listed in the build manifest', async () => {
    const env = makeEnv()
    await env.dispatch('install')
    const cached = [...[...env.store.values()][0].keys()]
    expect(cached).toEqual(expect.arrayContaining(['/', '/offline.html', '/assets/app.js']))
    expect(env.self.skipWaiting).toHaveBeenCalled()
  })

  it('install still works (minimal shell) when the manifest cannot be fetched', async () => {
    const env = makeEnv({ manifest: { bad: true } })
    await env.dispatch('install')
    expect([...env.store.values()][0].has('/')).toBe(true)
  })

  it('OFFLINE: navigation is served from the cached app shell', async () => {
    const env = makeEnv()
    await env.dispatch('install')
    env.state.network = false
    const res = await env.dispatch('fetch', { request: navReq('/') })
    expect(res.body).toBe('net:/')   // the precached "/" copy (network is down)
  })

  it('OFFLINE: unknown deep link falls back to the shell, not a browser error page', async () => {
    const env = makeEnv()
    await env.dispatch('install')
    env.state.network = false
    const res = await env.dispatch('fetch', { request: navReq('/some/deep/link') })
    expect(res.error).toBeUndefined()
    expect(res.body).toBeTruthy()
  })

  it('OFFLINE: precached JS assets are served from cache', async () => {
    const env = makeEnv()
    await env.dispatch('install')
    env.state.network = false
    const res = await env.dispatch('fetch', { request: assetReq('/assets/app.js') })
    expect(res.body).toBe('net:/assets/app.js')
  })

  it('NEVER intercepts /api/ or cross-origin requests (live SOS, sync, AI, maps must hit the network)', async () => {
    const env = makeEnv()
    await env.dispatch('install')
    let responded = false
    env.listeners.fetch({ request: { method: 'GET', mode: 'cors', url: 'https://app.test/api/chat' }, respondWith: () => { responded = true } })
    env.listeners.fetch({ request: { method: 'GET', mode: 'cors', url: 'https://maps.google.com/maps?q=1' }, respondWith: () => { responded = true } })
    env.listeners.fetch({ request: { method: 'GET', mode: 'cors', url: 'https://nominatim.openstreetmap.org/reverse' }, respondWith: () => { responded = true } })
    env.listeners.fetch({ request: { method: 'POST', mode: 'cors', url: 'https://app.test/anything' }, respondWith: () => { responded = true } })
    expect(responded).toBe(false)
  })

  it('activate removes caches from older versions', async () => {
    const env = makeEnv()
    env.store.set('sakhiai-v1-shell', new Map())
    await env.dispatch('activate')
    expect([...env.store.keys()].some((k) => k.startsWith('sakhiai-v1'))).toBe(false)
    expect(env.self.clients.claim).toHaveBeenCalled()
  })

  it('push shows an urgent notification', async () => {
    const env = makeEnv()
    await env.dispatch('push', { data: { json: () => ({ title: 'SOS', body: 'Help', urgent: true }) } })
    expect(env.self.registration.showNotification).toHaveBeenCalledWith('SOS', expect.objectContaining({ requireInteraction: true }))
  })
})
