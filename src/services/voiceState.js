/**
 * services/voiceState.js
 *
 * Pure state machine for voice input (no browser APIs → fully unit-testable).
 *
 *   idle ──START──► starting ──LISTENING──► listening ──STOP/END──► processing? ──► review
 *     ▲                                        │                                      │
 *     └────────────── RESET ◄─────────── error ◄─── ERROR ◄───────────────────────────┘
 *
 * phases: unsupported | idle | starting | listening | processing | review | error
 * error codes: denied | nospeech | network | nomic | unsupported | error
 */
export const VOICE_PHASE = Object.freeze({
  UNSUPPORTED: 'unsupported', IDLE: 'idle', STARTING: 'starting', LISTENING: 'listening',
  PROCESSING: 'processing', REVIEW: 'review', ERROR: 'error',
})

export const initialVoiceState = (supported = true) => ({
  phase: supported ? VOICE_PHASE.IDLE : VOICE_PHASE.UNSUPPORTED,
  interim: '',
  transcript: '',
  error: null,
  mode: null, // 'native' | 'server'
})

/** Maps SpeechRecognition error names / DOMException names to our error codes. */
export function mapVoiceError(name) {
  switch (name) {
    case 'not-allowed':
    case 'service-not-allowed':
    case 'NotAllowedError':
    case 'SecurityError':
      return 'denied'
    case 'no-speech':
      return 'nospeech'
    case 'network':
      return 'network'
    case 'audio-capture':
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'nomic'
    case 'language-not-supported':
    case 'unsupported':
      return 'unsupported'
    default:
      return 'error'
  }
}

export function voiceReducer(state, action) {
  switch (action.type) {
    case 'SUPPORT':
      return state.phase === VOICE_PHASE.UNSUPPORTED || state.phase === VOICE_PHASE.IDLE
        ? initialVoiceState(Boolean(action.supported))
        : state
    case 'START':
      if (state.phase === VOICE_PHASE.UNSUPPORTED) return state
      if ([VOICE_PHASE.STARTING, VOICE_PHASE.LISTENING, VOICE_PHASE.PROCESSING].includes(state.phase)) return state
      return { ...state, phase: VOICE_PHASE.STARTING, interim: '', transcript: '', error: null, mode: action.mode || 'native' }
    case 'LISTENING':
      return state.phase === VOICE_PHASE.STARTING ? { ...state, phase: VOICE_PHASE.LISTENING } : state
    case 'INTERIM':
      return state.phase === VOICE_PHASE.LISTENING ? { ...state, interim: action.text || '' } : state
    case 'FINAL':
      if (![VOICE_PHASE.LISTENING, VOICE_PHASE.STARTING, VOICE_PHASE.PROCESSING].includes(state.phase)) return state
      return { ...state, transcript: `${state.transcript} ${action.text || ''}`.trim(), interim: '' }
    case 'STOP': // user pressed stop: wait for the engine/server to finish
      return state.phase === VOICE_PHASE.LISTENING || state.phase === VOICE_PHASE.STARTING
        ? { ...state, phase: VOICE_PHASE.PROCESSING }
        : state
    case 'PROCESSING':
      return state.phase === VOICE_PHASE.LISTENING ? { ...state, phase: VOICE_PHASE.PROCESSING } : state
    case 'END': {
      // Engine finished. A transcript → review; none → "no speech" (unless already errored).
      if (state.phase === VOICE_PHASE.ERROR || state.phase === VOICE_PHASE.IDLE || state.phase === VOICE_PHASE.UNSUPPORTED) return state
      const text = `${state.transcript} ${state.interim}`.trim()
      return text
        ? { ...state, phase: VOICE_PHASE.REVIEW, transcript: text, interim: '' }
        : { ...state, phase: VOICE_PHASE.ERROR, error: 'nospeech', interim: '' }
    }
    case 'ERROR':
      return { ...state, phase: action.code === 'unsupported' && !state.transcript ? VOICE_PHASE.UNSUPPORTED : VOICE_PHASE.ERROR, error: action.code || 'error', interim: '' }
    case 'RESET':
      return initialVoiceState(state.phase !== VOICE_PHASE.UNSUPPORTED)
    default:
      return state
  }
}

export const isVoiceBusy = (state) => [VOICE_PHASE.STARTING, VOICE_PHASE.LISTENING, VOICE_PHASE.PROCESSING].includes(state.phase)
