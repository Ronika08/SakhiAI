import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VoiceButton, VoiceStatus } from './VoiceButton'
import LanguageSelector from './LanguageSelector'
import ConnectivityPanel from './ConnectivityPanel'
import { LanguageProvider, useLanguage } from '../i18n/LanguageContext'
import { translate } from '../i18n/translate'
import { initialVoiceState, voiceReducer } from '../services/voiceState'

const t = (k, v) => translate('en', k, v)
const make = (phase, extra = {}) => ({ state: { ...initialVoiceState(true), phase, ...extra }, start: vi.fn(), stop: vi.fn(), reset: vi.fn() })

describe('VoiceButton accessibility & states', () => {
  it('idle: labelled button, not pressed; click starts', async () => {
    const voice = make('idle')
    render(<VoiceButton voice={voice} t={t} />)
    const btn = screen.getByRole('button', { name: 'Start voice input' })
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(btn)
    expect(voice.start).toHaveBeenCalled()
  })
  it('listening: aria-pressed, label switches to stop, click stops', async () => {
    const voice = make('listening')
    render(<VoiceButton voice={voice} t={t} />)
    const btn = screen.getByRole('button', { name: 'Stop recording' })
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(btn)
    expect(voice.stop).toHaveBeenCalled()
  })
  it('processing: disabled', () => {
    render(<VoiceButton voice={make('processing')} t={t} />)
    expect(screen.getByRole('button')).toBeDisabled()
  })
  it('unsupported: explains why in the label', () => {
    render(<VoiceButton voice={make('unsupported')} t={t} />)
    expect(screen.getByRole('button', { name: /isn't supported/i })).toBeInTheDocument()
  })
})

describe('VoiceStatus messages', () => {
  it('listening shows interim text politely', () => {
    render(<VoiceStatus voice={make('listening', { interim: 'period pain' })} t={t} />)
    expect(screen.getByRole('status')).toHaveTextContent(/Listening/)
    expect(screen.getByRole('status')).toHaveTextContent('period pain')
  })
  it('processing and review states', () => {
    const { rerender } = render(<VoiceStatus voice={make('processing')} t={t} />)
    expect(screen.getByRole('status')).toHaveTextContent(/Processing/)
    rerender(<VoiceStatus voice={make('review', { transcript: 'x' })} t={t} />)
    expect(screen.getByRole('status')).toHaveTextContent(/edit it if needed/i)
  })
  it.each([
    ['denied', /permission is blocked/i],
    ['nospeech', /No speech was detected/i],
    ['nomic', /No microphone/i],
    ['network', /needs internet/i],
    ['error', /failed/i],
  ])('error "%s" is announced as an alert', (error, re) => {
    render(<VoiceStatus voice={make('error', { error })} t={t} />)
    expect(screen.getByRole('alert')).toHaveTextContent(re)
  })
  it('retry is offered for recoverable errors but not for permission denied', async () => {
    const v1 = make('error', { error: 'nospeech' })
    const { unmount } = render(<VoiceStatus voice={v1} t={t} />)
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(v1.start).toHaveBeenCalled()
    unmount()
    render(<VoiceStatus voice={make('error', { error: 'denied' })} t={t} />)
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })
  it('error messages are translated', () => {
    render(<VoiceStatus voice={make('error', { error: 'denied' })} t={(k, v) => translate('hi', k, v)} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/माइक्रोफ़ोन/)
  })
  it('the editable-transcript flow ends in REVIEW and never auto-sends', () => {
    const s = [{ type: 'START' }, { type: 'LISTENING' }, { type: 'FINAL', text: 'hello' }, { type: 'END' }].reduce(voiceReducer, initialVoiceState(true))
    expect(s.phase).toBe('review')   // user must press send
  })
})

function Probe() { const { lang, t: tt } = useLanguage(); return <div data-testid="p">{lang}|{tt('nav.home')}</div> }

describe('LanguageSelector', () => {
  it('has a visible label, three options, switches language and announces it', async () => {
    render(<LanguageProvider><LanguageSelector /><Probe /></LanguageProvider>)
    const select = screen.getByLabelText(/Language/)
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['English', 'हिन्दी', 'ಕನ್ನಡ'])
    expect(screen.getByTestId('p')).toHaveTextContent('en|Home')
    await userEvent.selectOptions(select, 'hi')
    expect(screen.getByTestId('p')).toHaveTextContent('hi|होम')
    expect(document.documentElement.lang).toBe('hi')
    expect(JSON.parse(localStorage.getItem('sakhi_lang'))).toBe('hi')
    await userEvent.selectOptions(screen.getByLabelText(/भाषा/), 'kn')
    expect(screen.getByTestId('p')).toHaveTextContent('kn|ಹೋಮ್')
    expect(screen.getAllByRole('status').some((n) => /ಕನ್ನಡ/.test(n.textContent))).toBe(true)
  })
})

describe('ConnectivityPanel', () => {
  it('states clearly what works offline and what needs internet', async () => {
    render(<LanguageProvider><ConnectivityPanel defaultOpen /></LanguageProvider>)
    expect(screen.getAllByText(/OFFLINE AVAILABLE/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/INTERNET REQUIRED/).length).toBeGreaterThan(0)
    expect(screen.getByText(/AI \(Gemini\) answers/)).toBeInTheDocument()
    expect(screen.getByText(/server SOS alerts/)).toBeInTheDocument()
  })
})
