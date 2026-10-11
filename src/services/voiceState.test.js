import { describe, it, expect } from 'vitest'
import { voiceReducer, initialVoiceState, mapVoiceError, isVoiceBusy, VOICE_PHASE as P } from './voiceState'

const run = (actions, start = initialVoiceState(true)) => actions.reduce(voiceReducer, start)

describe('voice input state machine', () => {
  it('starts idle, or unsupported when the device cannot do speech', () => {
    expect(initialVoiceState(true).phase).toBe(P.IDLE)
    expect(initialVoiceState(false).phase).toBe(P.UNSUPPORTED)
  })
  it('unsupported devices cannot start', () => {
    expect(run([{ type: 'START' }], initialVoiceState(false)).phase).toBe(P.UNSUPPORTED)
  })
  it('happy path: start → listening → interim → final → stop → review with the transcript', () => {
    let s = run([{ type: 'START' }])
    expect(s.phase).toBe(P.STARTING)
    s = run([{ type: 'LISTENING' }], s)
    expect(s.phase).toBe(P.LISTENING)
    s = run([{ type: 'INTERIM', text: 'period cra' }], s)
    expect(s.interim).toBe('period cra')
    s = run([{ type: 'FINAL', text: 'period cramps' }, { type: 'STOP' }, { type: 'END' }], s)
    expect(s).toMatchObject({ phase: P.REVIEW, transcript: 'period cramps', interim: '' })
  })
  it('uses interim text if the engine ends without a final result', () => {
    const s = run([{ type: 'START' }, { type: 'LISTENING' }, { type: 'INTERIM', text: 'hello there' }, { type: 'END' }])
    expect(s).toMatchObject({ phase: P.REVIEW, transcript: 'hello there' })
  })
  it('no speech → error "nospeech"', () => {
    const s = run([{ type: 'START' }, { type: 'LISTENING' }, { type: 'END' }])
    expect(s).toMatchObject({ phase: P.ERROR, error: 'nospeech' })
  })
  it('permission denied → error "denied"', () => {
    const s = run([{ type: 'START' }, { type: 'ERROR', code: mapVoiceError('not-allowed') }])
    expect(s).toMatchObject({ phase: P.ERROR, error: 'denied' })
  })
  it('an END after an ERROR does not overwrite the error', () => {
    const s = run([{ type: 'START' }, { type: 'ERROR', code: 'network' }, { type: 'END' }])
    expect(s).toMatchObject({ phase: P.ERROR, error: 'network' })
  })
  it('processing state while the server transcribes; ends in review', () => {
    const s = run([{ type: 'START', mode: 'server' }, { type: 'LISTENING' }, { type: 'STOP' }, { type: 'FINAL', text: 'ಹಲೋ' }, { type: 'END' }])
    expect(s).toMatchObject({ phase: P.REVIEW, transcript: 'ಹಲೋ', mode: 'server' })
  })
  it('cannot start twice while busy', () => {
    const s = run([{ type: 'START' }, { type: 'LISTENING' }])
    expect(isVoiceBusy(s)).toBe(true)
    expect(run([{ type: 'START' }], s)).toBe(s)
  })
  it('RESET returns to idle and clears the transcript/error', () => {
    const s = run([{ type: 'START' }, { type: 'ERROR', code: 'error' }, { type: 'RESET' }])
    expect(s).toMatchObject({ phase: P.IDLE, transcript: '', error: null })
  })
  it('an unsupported-language error before any transcript marks the device unsupported', () => {
    expect(run([{ type: 'START' }, { type: 'ERROR', code: 'unsupported' }]).phase).toBe(P.UNSUPPORTED)
  })
  it('maps engine error names', () => {
    expect(mapVoiceError('not-allowed')).toBe('denied')
    expect(mapVoiceError('NotAllowedError')).toBe('denied')
    expect(mapVoiceError('no-speech')).toBe('nospeech')
    expect(mapVoiceError('network')).toBe('network')
    expect(mapVoiceError('audio-capture')).toBe('nomic')
    expect(mapVoiceError('NotFoundError')).toBe('nomic')
    expect(mapVoiceError('language-not-supported')).toBe('unsupported')
    expect(mapVoiceError('whatever')).toBe('error')
  })
})
