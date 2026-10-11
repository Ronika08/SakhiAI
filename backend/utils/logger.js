/**
 * utils/logger.js
 *
 * Lightweight, dependency-free leveled logger.
 *
 * Every other backend file logs through this module instead of calling
 * console.* directly. The public interface (`logger.info/warn/error/debug`)
 * is unchanged. Additions:
 *  - request ID / user ID are attached automatically (see requestStore.js)
 *  - secrets (bearer tokens, JWTs, API keys, passwords) are redacted from
 *    every message before it is written
 *  - JSON-lines output in production for log aggregators
 */

import config from '../config/index.js';
import { getRequestContext } from './requestStore.js';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[config.logging.level] ?? LEVELS.info;

const REDACTIONS = [
  [/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]'],
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g, '[REDACTED_JWT]'],
  [/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED_KEY]'],
  [/sk-[A-Za-z0-9_-]{16,}/g, '[REDACTED_KEY]'],
  [/re_[A-Za-z0-9_]{16,}/g, '[REDACTED_KEY]'],
  [/([?&](?:key|api_key|apikey|token|access_token)=)[^&\s]+/gi, '$1[REDACTED]'],
  [/("?(?:password|passwd|secret|token|refreshToken|authorization)"?\s*[:=]\s*)"?[^",\s}]+"?/gi, '$1"[REDACTED]"'],
];

/** Exact secret values currently configured on this server — masked wherever they appear in a log line. */
function configuredSecrets() {
  const n = config.notifications;
  return [
    config.ai.gemini.apiKey, config.ai.anthropic.apiKey, config.ai.openai.apiKey, config.maps.apiKey,
    config.auth.jwtSecret, n.resend.apiKey, n.smtp.pass, n.webPush.privateKey, n.webhook.secret,
  ].filter((v) => typeof v === 'string' && v.length >= 8);
}

export function redact(value) {
  let text = typeof value === 'string' ? value : value instanceof Error ? value.message : String(value);
  for (const secret of configuredSecrets()) text = text.split(secret).join('[REDACTED_SECRET]');
  for (const [pattern, replacement] of REDACTIONS) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

function serializeMeta(meta) {
  return meta.map((m) => {
    if (m instanceof Error) return config.isProduction ? m.name : redact(m.stack || m.message);
    if (typeof m === 'string') return redact(m);
    try {
      return redact(JSON.stringify(m));
    } catch {
      return '[unserializable]';
    }
  });
}

function log(level, message, ...meta) {
  if (LEVELS[level] > currentLevel) return;

  const ctx = getRequestContext();
  const safeMessage = redact(message);
  const safeMeta = serializeMeta(meta).filter((m) => m !== undefined && m !== 'undefined');
  const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';

  if (config.isProduction) {
    const entry = {
      time: new Date().toISOString(),
      level,
      msg: safeMessage,
      ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
      ...(ctx.userId ? { userId: ctx.userId } : {}),
      ...(safeMeta.length ? { meta: safeMeta } : {}),
    };
    console[consoleMethod](JSON.stringify(entry));
    return;
  }

  const rid = ctx.requestId ? ` [${ctx.requestId.slice(0, 8)}]` : '';
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}]${rid} ${safeMessage}`;
  console[consoleMethod](line, ...safeMeta);
}

const logger = {
  error: (message, ...meta) => log('error', message, ...meta),
  warn: (message, ...meta) => log('warn', message, ...meta),
  info: (message, ...meta) => log('info', message, ...meta),
  debug: (message, ...meta) => log('debug', message, ...meta),
};

export default logger;
