import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

const gmaps = (body, status = 200) => ({ ok: status < 400, status, headers: new Headers(), json: async () => body })
const route = { status: 'OK', routes: [{ overview_polyline: { points: 'abc' }, legs: [{ distance: { value: 1200 }, duration: { value: 840 }, start_address: 'A', end_address: 'B', steps: [{ html_instructions: 'Turn <b>left</b>', distance: { value: 100 }, duration: { value: 60 } }] }] }] }

async function loadMaps(key = 'maps-test-key') {
  vi.resetModules()
  process.env.GOOGLE_MAPS_API_KEY = key
  return (await import('../services/mapsService.js')).default
}

describe('Google Maps service error handling', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  const A = { lat: 12.3, lng: 76.6 }
  const B = { lat: 12.31, lng: 76.65 }

  it('returns a normalised route', async () => {
    const maps = await loadMaps()
    fetch.mockResolvedValue(gmaps(route))
    const r = await maps.getRoute({ origin: A, destination: B })
    expect(r).toMatchObject({ distanceMeters: 1200, durationSeconds: 840 })
    expect(r.steps[0].instruction).toBe('Turn left')
  })

  it.each([
    ['OVER_QUERY_LIMIT', 429, 'MAP_ERROR'],
    ['REQUEST_DENIED', 503, 'MAP_ERROR'],
    ['ZERO_RESULTS', 404, 'MAP_ERROR'],
    ['UNKNOWN_ERROR', 502, 'MAP_ERROR'],
  ])('%s → %s %s without leaking provider text or the key', async (status, http, code) => {
    const maps = await loadMaps()
    fetch.mockResolvedValue(gmaps({ status, error_message: 'The provided API key maps-test-key is invalid' }))
    const err = await maps.getRoute({ origin: A, destination: B }).catch((e) => e)
    expect(err).toMatchObject({ statusCode: http, code })
    expect(err.message).not.toMatch(/maps-test-key|provided API key/)
  })

  it('timeout and network failures are categorised NETWORK_ERROR', async () => {
    const maps = await loadMaps()
    fetch.mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' }))
    expect(await maps.getRoute({ origin: A, destination: B }).catch((e) => e)).toMatchObject({ statusCode: 504, code: 'NETWORK_ERROR' })
    fetch.mockRejectedValue(new TypeError('fetch failed'))
    expect(await maps.getRoute({ origin: A, destination: B }).catch((e) => e)).toMatchObject({ statusCode: 502, code: 'NETWORK_ERROR' })
  })

  it('missing server key → MAP_ERROR 503 with a safe message', async () => {
    const maps = await loadMaps('')
    const err = await maps.getRoute({ origin: A, destination: B }).catch((e) => e)
    expect(err).toMatchObject({ statusCode: 503, code: 'MAP_ERROR' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('geocodes addresses on the server', async () => {
    const maps = await loadMaps()
    fetch.mockResolvedValue(gmaps({ status: 'OK', results: [{ geometry: { location: { lat: 12.29, lng: 76.64 } } }] }))
    expect(await maps.geocodeAddress('Mysuru Palace')).toEqual({ lat: 12.29, lng: 76.64 })
    fetch.mockResolvedValue(gmaps({ status: 'ZERO_RESULTS' }))
    expect(await maps.geocodeAddress('nowhere xyz').catch((e) => e)).toMatchObject({ statusCode: 404, code: 'MAP_ERROR' })
  })
})

describe('POST /api/routes/plan', () => {
  it('requires authentication', async () => {
    vi.resetModules()
    vi.doMock('../config/db.js', () => ({ isDbConnected: () => true, pingDB: async () => true, connectDB: async () => {}, disconnectDB: async () => {} }))
    const app = (await import('../app.js')).default
    expect((await request(app).post('/api/routes/plan').send({})).status).toBe(401)
    vi.doUnmock('../config/db.js')
  })
})
