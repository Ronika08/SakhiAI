import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

/**
 * End-to-end chat behaviour of the hybrid flow:
 * Rule Engine → Intent Engine → backend /api/chat (→ Gemini)
 */
async function openChatAndSend(text) {
  render(<App />)
  await userEvent.click(screen.getAllByRole('button', { name: /chat/i })[0])
  const input = await screen.findByPlaceholderText(/ask|message|type/i)
  await userEvent.type(input, `${text}{Enter}`)
}

describe('chat hybrid flow', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200, headers: new Headers(),
      json: async () => ({ success: true, response: 'Endometriosis is a condition…', provider: 'gemini' }),
    })))
  })

  it('"Hi" is answered by the Rule Engine without calling the backend', async () => {
    await openChatAndSend('Hi')
    await waitFor(() => expect(screen.getAllByText(/hello|hi|namaste|welcome/i).length).toBeGreaterThan(1), { timeout: 3000 })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('"PCOS diet" is answered by the Intent Engine without calling the backend', async () => {
    await openChatAndSend('PCOS diet')
    // user bubble + intent reply both mention diet → expect at least two matches
    await waitFor(() => expect(screen.getAllByText(/diet/i).length).toBeGreaterThan(1), { timeout: 3000 })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('"Explain endometriosis" falls back to the backend and sends only messages + language (no model/system/key)', async () => {
    await openChatAndSend('Explain endometriosis')
    await screen.findByText(/Endometriosis is a condition/, {}, { timeout: 4000 })
    const chatCall = fetch.mock.calls.find(([url]) => String(url).endsWith('/api/chat'))
    expect(chatCall).toBeTruthy()
    const body = JSON.parse(chatCall[1].body)
    expect(Object.keys(body).sort()).toEqual(['language', 'messages'])
    expect(body.language).toBe('en')
    expect(JSON.stringify(body)).not.toMatch(/model|system|api[_-]?key/i)
  })

  it('shows the server-provided safe fallback when the AI is down', async () => {
    fetch.mockResolvedValue({
      ok: false, status: 503, headers: new Headers(),
      json: async () => ({ success: false, code: 'AI_UNAVAILABLE', message: 'x', fallbackResponse: 'Assistant unavailable — call 112 if urgent.' }),
    })
    await openChatAndSend('Explain endometriosis')
    await screen.findByText(/Assistant unavailable — call 112/, {}, { timeout: 4000 })
  })
})
