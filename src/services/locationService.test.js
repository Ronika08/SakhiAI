import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getPreciseLocation, classifyAccuracy, isValidCoordinate } from './locationService'

const mockGeo = (impl) => Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: vi.fn(impl) }, configurable: true })
const success = (c) => (ok) => ok({ coords: c, timestamp: 1700000000000 })
const failure = (code) => (_ok, err) => err({ code })

describe('locationService', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('returns a valid precise location', async () => {
    mockGeo(success({ latitude: 12.3, longitude: 76.6, accuracy: 15 }))
    const r = await getPreciseLocation()
    expect(r).toMatchObject({ ok: true, quality: 'good', location: { lat: 12.3, lng: 76.6, accuracy: 15 } })
  })
  it('warns on inaccurate positions', async () => {
    mockGeo(success({ latitude: 12.3, longitude: 76.6, accuracy: 4000 }))
    const r = await getPreciseLocation()
    expect(r.quality).toBe('poor')
    expect(r.warning).toMatch(/approximate/)
  })
  it('permission denied is reported and not retried', async () => {
    mockGeo(failure(1))
    const r = await getPreciseLocation()
    expect(r).toMatchObject({ ok: false, code: 'PERMISSION_DENIED' })
    expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledTimes(1)
  })
  it('timeout falls back to a low-accuracy attempt, then reports TIMEOUT', async () => {
    mockGeo(failure(3))
    const r = await getPreciseLocation()
    expect(r).toMatchObject({ ok: false, code: 'TIMEOUT' })
    expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledTimes(2)
  })
  it('rejects the bogus (0,0) coordinate', async () => {
    mockGeo(success({ latitude: 0, longitude: 0, accuracy: 5 }))
    expect((await getPreciseLocation()).code).toBe('INVALID')
  })
  it('reports unsupported browsers', async () => {
    Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true })
    expect((await getPreciseLocation()).code).toBe('UNSUPPORTED')
  })
  it('helpers', () => {
    expect(classifyAccuracy(500)).toBe('low')
    expect(isValidCoordinate(91, 10)).toBe(false)
    expect(isValidCoordinate(12, 77)).toBe(true)
  })
})
