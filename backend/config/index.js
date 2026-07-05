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
 */

import dotenv from 'dotenv';

dotenv.config();

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
 * Reads a required environment variable.
 * Throws at startup (fail-fast) if missing in production, otherwise warns.
 */
function requireEnv(key, { requiredInProduction = true } = {}) {
  const value = process.env[key];
  if (!value) {
    const message = `Missing environment variable: ${key}`;
    if (requiredInProduction && process.env.NODE_ENV === 'production') {
      throw new Error(message);
    }
    // eslint-disable-next-line no-console
    console.warn(`[config] Warning: ${message} (not set)`);
  }
  return value || '';
}

const env = process.env.NODE_ENV || 'development';

const config = {
  env,
  isProduction: env === 'production',

  port: parseInt(process.env.PORT, 10) || 5000,

  cors: {
    // e.g. CORS_ALLOWED_ORIGINS="http://localhost:5173,https://sakhiai.app"
    allowedOrigins: parseList(process.env.CORS_ALLOWED_ORIGINS).length
      ? parseList(process.env.CORS_ALLOWED_ORIGINS)
      : ['http://localhost:5173'],
  },

  database: {
    // Optional for now — MongoDB integration is a pending feature.
    mongoUri: process.env.MONGODB_URI || '',
  },

  auth: {
    // Optional for now — JWT auth is a pending feature.
    jwtSecret: process.env.JWT_SECRET || '',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  ai: {
    // Which provider to use by default when a request doesn't specify one.
    defaultProvider: process.env.DEFAULT_AI_PROVIDER || 'anthropic',

    anthropic: {
      apiKey: requireEnv('ANTHROPIC_API_KEY', { requiredInProduction: false }),
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    },

    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    },

    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    },
  },

  maps: {
    // Powers the Safe Route Planning feature (services/mapsService.js).
    apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  },

  logging: {
    level: process.env.LOG_LEVEL || (env === 'production' ? 'info' : 'debug'),
  },
};

export default config;
