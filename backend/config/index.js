/**
 * config/index.js
 *
 * Centralized application configuration.
 *
 * All environment variables are read exactly once, here, and validated.
 * The rest of the codebase should import `config` from this file rather
 * than reading `process.env` directly — this keeps env access auditable
 * and makes it trivial to catch missing/invalid configuration at startup
 * instead of failing deep inside a request handler.
 *
 * Secrets (API keys, JWT secret, DB credentials) live ONLY in the backend
 * environment. Nothing in this file is ever sent to the frontend.
 */

import dotenv from 'dotenv';

if (process.env.SKIP_DOTENV !== 'true') {
  dotenv.config();
}

/**
 * Parses a comma-separated env string into a trimmed array.
 * Returns an empty array if the value is missing.
 */
function parseList(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Parses a positive integer from an env string, falling back to a default
 * when the value is missing, non-numeric, or not positive.
 */
function parsePositiveInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Model names are interpolated into the Gemini request URL, so only a safe
 * character set is accepted (letters, digits, dot, dash, underscore).
 * Anything else falls back to the provided default instead of being used.
 */
function parseModelName(value, fallback) {
  const trimmed = (value || '').trim();
  return /^[A-Za-z0-9._-]+$/.test(trimmed) ? trimmed : fallback;
}

const env = process.env.NODE_ENV || 'development';

// Gemini 1.5 / 2.0 models are shut down, and Gemini 2.5 Flash is scheduled
// for shutdown on 2026-10-16. `gemini-3.5-flash` is the current GA Flash
// model. Override with GEMINI_MODEL in backend/.env — never in the frontend.
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';
// Used automatically when the primary model is unavailable (404) or its
// quota is exhausted (429). Set GEMINI_FALLBACK_MODEL= (empty) to disable.
const DEFAULT_GEMINI_FALLBACK_MODEL = 'gemini-3.1-flash-lite';

const geminiFallbackRaw = process.env.GEMINI_FALLBACK_MODEL;

const config = {
  env,
  isProduction: env === 'production',

  port: parseInt(process.env.PORT, 10) || 5000,

  // Number of reverse-proxy hops to trust for client IPs (rate limiting).
  // Set to 1 on Render/Railway/Fly/Heroku-style platforms.
  trustProxy: parseInt(process.env.TRUST_PROXY, 10) || 0,

  // Public URL of the frontend (used in password-reset links and alerts).
  appUrl: (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, ''),

  cors: {
    // e.g. CORS_ALLOWED_ORIGINS="http://localhost:5173,https://sakhiai.app"
    allowedOrigins: parseList(process.env.CORS_ALLOWED_ORIGINS).length
      ? parseList(process.env.CORS_ALLOWED_ORIGINS)
      : ['http://localhost:5173'],
  },

  database: {
    mongoUri: process.env.MONGODB_URI || '',
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET || '',
    // Legacy variable kept for backward compatibility with existing .env files.
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    // Short-lived access token; long-lived sessions use rotating refresh tokens.
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresDays: parsePositiveInt(process.env.REFRESH_TOKEN_DAYS, 30),
    resetTokenMinutes: parsePositiveInt(process.env.PASSWORD_RESET_MINUTES, 30),
    bcryptRounds: Math.min(parsePositiveInt(process.env.BCRYPT_ROUNDS, 12), 15),
  },

  rateLimit: {
    windowMs: parsePositiveInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: parsePositiveInt(process.env.RATE_LIMIT_MAX, 300),
  },

  // Free / no-cost SOS notification channels. Every channel is optional;
  // a channel with missing configuration reports NOT_CONFIGURED honestly.
  notifications: {
    // Generic webhook(s): ntfy.sh, Discord, Slack, Telegram bot URL, Make/Zapier, ...
    webhook: {
      urls: parseList(process.env.NOTIFY_WEBHOOK_URLS),
      secret: process.env.NOTIFY_WEBHOOK_SECRET || '',
      timeoutMs: parsePositiveInt(process.env.NOTIFY_TIMEOUT_MS, 8000),
    },
    // Email via Resend's HTTPS API (free tier) ...
    resend: {
      apiKey: process.env.RESEND_API_KEY || '',
      from: process.env.EMAIL_FROM || '',
    },
    // ... or any SMTP server (Gmail app password, Brevo/Mailjet free tiers, ...)
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: parsePositiveInt(process.env.SMTP_PORT, 587),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      from: process.env.EMAIL_FROM || process.env.SMTP_USER || '',
    },
    // Web Push (free, standards-based). Generate keys: npx web-push generate-vapid-keys
    webPush: {
      publicKey: process.env.VAPID_PUBLIC_KEY || '',
      privateKey: process.env.VAPID_PRIVATE_KEY || '',
      subject: process.env.VAPID_SUBJECT || '',
    },
  },

  ai: {
    // Which provider to use when a request doesn't specify one.
    // Gemini is the primary provider for SakhiAI.
    defaultProvider: (process.env.DEFAULT_AI_PROVIDER || 'gemini').toLowerCase(),

    // Backend-owned limits applied to every chat request, regardless of
    // what the client sends.
    maxOutputTokens: parsePositiveInt(process.env.AI_MAX_OUTPUT_TOKENS, 1024),
    maxHistoryMessages: parsePositiveInt(process.env.AI_MAX_HISTORY_MESSAGES, 20),
    maxMessageChars: parsePositiveInt(process.env.AI_MAX_MESSAGE_CHARS, 2000),

    anthropic: {
      // Optional: Anthropic is a secondary provider (Gemini is primary).
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    },

    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    },

    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      model: parseModelName(process.env.GEMINI_MODEL, DEFAULT_GEMINI_MODEL),
      // `undefined` => use default fallback; empty string => fallback disabled.
      fallbackModel:
        geminiFallbackRaw === undefined
          ? DEFAULT_GEMINI_FALLBACK_MODEL
          : parseModelName(geminiFallbackRaw, ''),
      // Hard upper bound on a single Gemini HTTP call.
      timeoutMs: parsePositiveInt(process.env.GEMINI_TIMEOUT_MS, 20000),
      // Retries apply only to transient failures (network, 5xx).
      maxRetries: Math.min(parsePositiveInt(process.env.GEMINI_MAX_RETRIES, 1), 3),
    },
  },

  // Optional ONLINE speech-to-text fallback (used only when the browser has no
  // native speech recognition). OFF by default: audio is sent to Gemini only
  // when an operator explicitly enables it.
  voice: {
    serverSttEnabled: process.env.VOICE_STT_ENABLED === 'true',
    maxAudioBytes: parsePositiveInt(process.env.VOICE_MAX_AUDIO_BYTES, 1500000),
  },

  maps: {
    // Powers the Safe Route Planning feature (services/mapsService.js).
    apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  },

  tests: { enabled: env === 'test' },

  logging: {
    level: process.env.LOG_LEVEL || (env === 'production' ? 'info' : 'debug'),
  },
};

// Fail fast in production if Gemini is the default provider but has no key.
// (In development a missing key only produces a warning, so the rest of the
// app can still be worked on.)
if (config.ai.defaultProvider === 'gemini' && !config.ai.gemini.apiKey) {
  const message = 'Missing environment variable: GEMINI_API_KEY (default AI provider is "gemini")';
  if (config.isProduction) {
    throw new Error(message);
  }
  console.warn(`[config] Warning: ${message}`);
}

export default config;
