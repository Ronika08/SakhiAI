import { describe, it, expect, vi, beforeEach } from 'vitest'
import api, { ApiError, setTokens, clearTokens, getAccessToken, setSessionExpiredHandler } from './apiClient'

const json = (status, body) => ({ ok: status < 400, status, headers: new Headers(), json: async () => body })

describe('apiClient', () => {
  beforeEach(() => { clearTokens(); vi.stubGlobal('fetch', vi.fn()); setSessionExpiredHandler(() => {}) })

  it('returns the data field and sends the bearer token', async () => {
    setTokens({ token: 'access-1' })
    fetch.mockResolvedValue(json(200, { success: true, data: { hello: 'world' } }))
    await expect(api('/api/x')).resolves.toEqual({ hello: 'world' })
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer access-1')
  })

  it('never sends model/provider/system secrets — only what the caller passes', async () => {
    fetch.mockResolvedValue(json(200, { success: true, data: {} }))
    await api('/api/chat', { method: 'POST', auth: false, body: { messages: [{ role: 'user', content: 'hi' }] } })
    const sent = JSON.parse(fetch.mock.calls[0][1].body)
    expect(Object.keys(sent)).toEqual(['messages'])
    expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined()
  })

  it('normalises backend errors into ApiError with a safe userMessage', async () => {
    fetch.mockResolvedValue(json(503, { success: false, message: 'internal stack trace here', code: 'AI_UNAVAILABLE', requestId: 'r1' }))
    const err = await api('/api/chat', { auth: false }).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe('AI_UNAVAILABLE')
    expect(err.userMessage).not.toMatch(/stack/)
    expect(err.requestId).toBe('r1')
  })

  it('maps network failures and offline state', async () => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'))
    expect((await api('/api/x', { auth: false }).catch((e) => e)).code).toBe('NETWORK_ERROR')
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    expect((await api('/api/x', { auth: false }).catch((e) => e)).code).toBe('NETWORK_OFFLINE')
  })

  it('refreshes once on TOKEN_EXPIRED and retries the request', async () => {
    setTokens({ token: 'old', refreshToken: 'refresh-token-value-0123456789' })
    fetch
      .mockResolvedValueOnce(json(401, { success: false, code: 'TOKEN_EXPIRED', message: 'expired' }))
      .mockResolvedValueOnce(json(200, { success: true, data: { token: 'new', refreshToken: 'rotated-refresh-0123456789', user: {} } }))
      .mockResolvedValueOnce(json(200, { success: true, data: { ok: 1 } }))
    await expect(api('/api/contacts')).resolves.toEqual({ ok: 1 })
    expect(getAccessToken()).toBe('new')
    expect(localStorage.getItem('sakhi_refresh_token')).toBe('rotated-refresh-0123456789')
    expect(fetch.mock.calls[2][1].headers.Authorization).toBe('Bearer new')
  })

  it('clears the session and notifies when refresh fails', async () => {
    const expired = vi.fn()
    setSessionExpiredHandler(expired)
    setTokens({ token: 'old', refreshToken: 'refresh-token-value-0123456789' })
    fetch
      .mockResolvedValueOnce(json(401, { success: false, code: 'TOKEN_EXPIRED' }))
      .mockResolvedValueOnce(json(401, { success: false, code: 'AUTHENTICATION_ERROR' }))
    await expect(api('/api/contacts')).rejects.toBeInstanceOf(ApiError)
    expect(expired).toHaveBeenCalled()
    expect(getAccessToken()).toBeNull()
    expect(localStorage.getItem('sakhi_refresh_token')).toBeNull()
  })
})
