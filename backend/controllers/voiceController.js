/**
 * controllers/voiceController.js
 *
 * OPTIONAL online speech-to-text fallback for browsers without native speech
 * recognition. Disabled unless VOICE_STT_ENABLED=true. The transcript is
 * returned to the client to be EDITED before sending — it is never sent to
 * the chat automatically, and the audio is never stored or logged.
 */

import { AppError } from '../middleware/errorHandler.js';
import config from '../config/index.js';
import geminiService from '../services/geminiService.js';
import { normalizeLanguage } from '../services/chatSafetyI18n.js';

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const ALLOWED_MIME = /^audio\/(webm|ogg|mp4|mpeg|mp3|wav|x-wav|aac|m4a|x-m4a)(;.*)?$/i;

/** GET /api/voice/status – lets the UI know whether the online fallback exists. */
export const getStatus = (req, res) => {
  res.status(200).json({
    success: true,
    data: { serverSttEnabled: config.voice.serverSttEnabled && Boolean(config.ai.gemini.apiKey) },
  });
};

/** POST /api/voice/transcribe  { audioBase64, mimeType, language? } */
export const transcribe = asyncHandler(async (req, res) => {
  if (!config.voice.serverSttEnabled) {
    throw new AppError('Online speech-to-text is not enabled on this server.', 503, null, 'AI_UNAVAILABLE');
  }

  const { audioBase64, mimeType } = req.body || {};
  if (typeof audioBase64 !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(audioBase64) || audioBase64.length < 100) {
    throw new AppError('Field "audioBase64" must be base64 audio data.', 400, null, 'VALIDATION_ERROR');
  }
  if (typeof mimeType !== 'string' || !ALLOWED_MIME.test(mimeType)) {
    throw new AppError('Field "mimeType" must be a supported audio type.', 400, null, 'VALIDATION_ERROR');
  }
  const approxBytes = Math.floor((audioBase64.length * 3) / 4);
  if (approxBytes > config.voice.maxAudioBytes) {
    throw new AppError('The recording is too long. Please record a shorter message.', 413, null, 'PAYLOAD_TOO_LARGE');
  }

  const { text } = await geminiService.transcribeAudio({
    audioBase64,
    mimeType: mimeType.split(';')[0],
    language: normalizeLanguage(req.body.language),
  });

  if (!text) throw new AppError('No speech was detected. Please try again.', 422, null, 'AI_BAD_RESPONSE');
  // Never allow absurdly long output to reach the input box.
  res.status(200).json({ success: true, data: { text: text.slice(0, 2000) } });
});

export default { getStatus, transcribe };
