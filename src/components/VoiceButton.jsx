/**
 * components/VoiceButton.jsx
 *
 * Microphone button + live status. Accessible: real <button> with aria-pressed
 * and a dynamic label, a polite live region announces state changes, and every
 * error state has plain-language text and (where useful) a retry.
 */
import { VOICE_PHASE, isVoiceBusy } from '../services/voiceState'

const ERROR_KEY = {
  denied: 'voice.denied', nospeech: 'voice.nospeech', network: 'voice.network',
  nomic: 'voice.nomic', unsupported: 'voice.unsupported', error: 'voice.error',
}

export function VoiceButton({ voice, t }) {
  const { state, start, stop } = voice
  const busy = isVoiceBusy(state)
  const listening = state.phase === VOICE_PHASE.LISTENING
  const unsupported = state.phase === VOICE_PHASE.UNSUPPORTED
  const label = listening ? t('voice.stop') : unsupported ? t('voice.unsupported') : t('voice.start')

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      disabled={state.phase === VOICE_PHASE.PROCESSING || state.phase === VOICE_PHASE.STARTING}
      aria-pressed={listening}
      aria-label={label}
      title={label}
      className={listening ? 'voice-btn voice-btn-live' : 'voice-btn'}
      style={{
        background: listening ? '#c62828' : unsupported ? '#eeeeee' : '#fce4ec',
        border: `1px solid ${listening ? '#c62828' : '#f48fb1'}`, borderRadius: '50%', color: listening ? '#fff' : '#880e4f',
        width: 44, height: 44, fontSize: 18, cursor: unsupported ? 'not-allowed' : 'pointer', flexShrink: 0,
        opacity: busy && !listening ? 0.6 : 1,
      }}
    >
      <span aria-hidden="true">{listening ? '⏹' : '🎤'}</span>
    </button>
  )
}

/** Status line under the input: listening / processing / review hint / errors. */
export function VoiceStatus({ voice, t }) {
  const { state, start, reset } = voice
  const { phase, interim, error } = state
  if (phase === VOICE_PHASE.IDLE) return <div role="status" aria-live="polite" className="sr-only" />

  let content = null
  let tone = { bg: '#fce4ec', fg: '#880e4f', border: '#f48fb1' }

  if (phase === VOICE_PHASE.STARTING) content = <span>🎤 {t('common.loading')}</span>
  else if (phase === VOICE_PHASE.LISTENING) {
    content = <span><span className="voice-dot" aria-hidden="true" /> {t('voice.listening')}{interim ? <em style={{ display: 'block', opacity: 0.8 }}>“{interim}”</em> : null}</span>
    tone = { bg: '#ffebee', fg: '#b71c1c', border: '#ef9a9a' }
  } else if (phase === VOICE_PHASE.PROCESSING) content = <span>⏳ {t('voice.processing')}</span>
  else if (phase === VOICE_PHASE.REVIEW) {
    content = <span>✏️ {t('voice.review')}</span>
    tone = { bg: '#e8f5e9', fg: '#1b5e20', border: '#a5d6a7' }
  } else if (phase === VOICE_PHASE.ERROR || phase === VOICE_PHASE.UNSUPPORTED) {
    content = <span>{t(ERROR_KEY[error] || 'voice.error')}{error === 'network' ? ` ${t('voice.online.note')}` : ''}</span>
    tone = { bg: '#fff3e0', fg: '#7a3d00', border: '#ffcc80' }
  }

  const canRetry = phase === VOICE_PHASE.ERROR && ['nospeech', 'error', 'network'].includes(error)
  return (
    <div role={phase === VOICE_PHASE.ERROR ? 'alert' : 'status'} aria-live={phase === VOICE_PHASE.ERROR ? 'assertive' : 'polite'}
      style={{ background: tone.bg, color: tone.fg, border: `1px solid ${tone.border}`, margin: '0 16px 8px', padding: '8px 12px', borderRadius: 12, fontSize: 13, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
      {content}
      <span style={{ display: 'flex', gap: 6 }}>
        {canRetry && <button type="button" onClick={start} style={miniBtn(tone.fg)}>{t('common.retry')}</button>}
        {(phase === VOICE_PHASE.ERROR || phase === VOICE_PHASE.REVIEW || phase === VOICE_PHASE.UNSUPPORTED) && (
          <button type="button" onClick={reset} aria-label={t('common.dismiss')} style={miniBtn(tone.fg)}>✕</button>
        )}
      </span>
    </div>
  )
}

const miniBtn = (color) => ({ background: 'transparent', border: `1px solid ${color}`, color, borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 12, minHeight: 32 })
