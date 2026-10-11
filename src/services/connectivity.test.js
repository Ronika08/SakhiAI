import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as C from './connectivity'

describe('connectivity', () => {
  beforeEach(() => { vi.restoreAllMocks(); C._resetConnectivity() })

  it('reflects navigator.onLine and notifies subscribers', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    const seen = []
    C.subscribeConnectivity((s) => seen.push(s))
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    C.reportNetworkFailure()
    expect(C.getConnectivity()).toBe('offline')
    expect(C.isOnline()).toBe(false)
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    C.reportNetworkSuccess()
    expect(C.isOnline()).toBe(true)
    expect(seen).toEqual(['offline', 'online'])
  })

  it('"online" device but unreachable server → server_unreachable (not offline)', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    C.reportNetworkFailure()
    expect(C.getConnectivity()).toBe('server_unreachable')
    expect(C.isOnline()).toBe(false)
  })

  it('pingBackend: ok → online; failure → server_unreachable; offline → no request', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    const ok = vi.fn(async () => ({ ok: true }))
    expect(await C.pingBackend({ fetchImpl: ok })).toBe(true)
    expect(C.getConnectivity()).toBe('online')
    const bad = vi.fn(async () => { throw new Error('x') })
    expect(await C.pingBackend({ fetchImpl: bad })).toBe(false)
    expect(C.getConnectivity()).toBe('server_unreachable')
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const never = vi.fn()
    expect(await C.pingBackend({ fetchImpl: never })).toBe(false)
    expect(never).not.toHaveBeenCalled()
    expect(C.getConnectivity()).toBe('offline')
  })

  it('reacts to browser online/offline events', () => {
    const stop = C.startConnectivityMonitor()
    window.dispatchEvent(new Event('offline'))
    expect(C.getConnectivity()).toBe('offline')
    stop()
  })
})
