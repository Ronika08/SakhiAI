/**
 * hooks/useVoiceInput.js
 *
 * Voice input for chat.
 *
 *  1. PREFERRED — the browser/device's native SpeechRecognition. No SakhiAI
 *     server or AI service is involved. When offline we ask the browser for
 *     on-device recognition (`processLocally`) where it is supported; on other
 *     browsers recognition itself needs the vendor's online service, which is
 *     reported honestly as a "network" error.
 *  2. OPTIONAL FALLBACK — only if the browser has no SpeechRecognition AND the
 *     operator enabled VOICE_STT_ENABLED on the backend: record with
 *     MediaRecorder (≤ 30 s) and transcribe through the backend. Online only.
 *
 * The transcript is NEVER sent automatically: it is placed in the chat input
 * through `onTranscript` so the user can edit it first.
 */
import { useCallback, useEffect, useReducer, useRef } from 'react'
import { voiceReducer, initialVoiceState, mapVoiceError, VOICE_PHASE } from '../services/voiceState'
import { speechLocale } from '../i18n/translate'
import api from '../services/apiClient'

const getRecognitionCtor = () =>
  typeof window === 'undefined' ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null

const MAX_RECORD_MS = 30000
const pickMime = () => {
  if (typeof MediaRecorder === 'undefined') return null
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported?.(m)) || ''
}

export const nativeSpeechSupported = () => Boolean(getRecognitionCtor())

export default function useVoiceInput({ lang = 'en', online = true, onTranscript } = {}) {
  // Whether the OPTIONAL online fallback is enabled on the server is only checked
  // when the user actually presses the microphone (no background network request).
  const serverSttRef = useRef(null)
  const nativeOk = nativeSpeechSupported()
  const mediaOk = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined'
  const supported = nativeOk || mediaOk
  const [state, dispatch] = useReducer(voiceReducer, undefined, () => initialVoiceState(nativeOk || mediaOk))
  const recRef = useRef(null)
  const recorderRef = useRef(null)
  const timerRef = useRef(null)
  const onTranscriptRef = useRef(onTranscript)
  useEffect(() => { onTranscriptRef.current = onTranscript }, [onTranscript])

  useEffect(() => { dispatch({ type: 'SUPPORT', supported }) }, [supported])

  // Hand the final transcript to the chat input exactly once per recording.
  useEffect(() => {
    if (state.phase === VOICE_PHASE.REVIEW && state.transcript) onTranscriptRef.current?.(state.transcript)
  }, [state.phase, state.transcript])

  const cleanup = useCallback(() => {
    clearTimeout(timerRef.current)
    try { recRef.current?.abort?.() } catch { /* already stopped */ }
    recRef.current = null
    const rec = recorderRef.current
    if (rec) { try { rec.stream?.getTracks().forEach((t) => t.stop()); if (rec.state !== 'inactive') rec.stop() } catch { /* ignore */ } }
    recorderRef.current = null
  }, [])
  useEffect(() => cleanup, [cleanup])

  const startNative = useCallback(() => {
    const Ctor = getRecognitionCtor()
    const rec = new Ctor()
    rec.lang = speechLocale(lang)
    rec.interimResults = true
    rec.continuous = false
    rec.maxAlternatives = 1
    // Offline: request on-device recognition where the browser supports it.
    if (!online && 'processLocally' in rec) { try { rec.processLocally = true } catch { /* not supported */ } }

    rec.onstart = () => dispatch({ type: 'LISTENING' })
    rec.onresult = (e) => {
      let interim = ''
      let final = ''
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const r = e.results[i]
        if (r.isFinal) final += r[0].transcript
        else interim += r[0].transcript
      }
      if (final) dispatch({ type: 'FINAL', text: final })
      if (interim) dispatch({ type: 'INTERIM', text: interim })
    }
    rec.onerror = (e) => dispatch({ type: 'ERROR', code: mapVoiceError(e.error) })
    rec.onend = () => { recRef.current = null; dispatch({ type: 'END' }) }
    recRef.current = rec
    try { rec.start() } catch { dispatch({ type: 'ERROR', code: 'error' }) }
  }, [lang, online])

  const startServer = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = pickMime()
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      const chunks = []
      rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        clearTimeout(timerRef.current)
        if (!chunks.length) { dispatch({ type: 'END' }); return }
        dispatch({ type: 'PROCESSING' })
        try {
          const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' })
          const audioBase64 = await new Promise((resolve, reject) => {
            const fr = new FileReader()
            fr.onload = () => resolve(String(fr.result).split(',')[1] || '')
            fr.onerror = reject
            fr.readAsDataURL(blob)
          })
          const data = await api('/api/voice/transcribe', { method: 'POST', auth: false, body: { audioBase64, mimeType: blob.type, language: lang } })
          dispatch({ type: 'FINAL', text: data.text || '' })
          dispatch({ type: 'END' })
        } catch (err) {
          dispatch({ type: 'ERROR', code: ['NETWORK_ERROR', 'NETWORK_OFFLINE', 'TIMEOUT'].includes(err?.code) ? 'network' : 'error' })
        }
      }
      recorderRef.current = rec
      rec.start()
      dispatch({ type: 'LISTENING' })
      timerRef.current = setTimeout(() => { if (rec.state !== 'inactive') { dispatch({ type: 'STOP' }); rec.stop() } }, MAX_RECORD_MS)
    } catch (err) {
      dispatch({ type: 'ERROR', code: mapVoiceError(err?.name) })
    }
  }, [lang])

  const start = useCallback(async () => {
    if (!supported) { dispatch({ type: 'ERROR', code: 'unsupported' }); return }
    const mode = nativeOk ? 'native' : 'server'
    dispatch({ type: 'START', mode })
    if (mode === 'native') { startNative(); return }
    // No native speech recognition: the online fallback needs internet AND operator opt-in.
    if (!online) { dispatch({ type: 'ERROR', code: 'network' }); return }
    if (serverSttRef.current === null) {
      try { serverSttRef.current = Boolean((await api('/api/voice/status', { auth: false }))?.serverSttEnabled) } catch { serverSttRef.current = null; dispatch({ type: 'ERROR', code: 'network' }); return }
    }
    if (!serverSttRef.current) { dispatch({ type: 'ERROR', code: 'unsupported' }); return }
    startServer()
  }, [supported, nativeOk, online, startNative, startServer])

  const stop = useCallback(() => {
    dispatch({ type: 'STOP' })
    if (recRef.current) { try { recRef.current.stop() } catch { /* ignore */ } }
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }, [])

  const cancel = useCallback(() => { cleanup(); dispatch({ type: 'RESET' }) }, [cleanup])
  const reset = useCallback(() => dispatch({ type: 'RESET' }), [])

  return { state, supported, mode: nativeOk ? 'native' : mediaOk ? 'server' : null, start, stop, cancel, reset }
}
