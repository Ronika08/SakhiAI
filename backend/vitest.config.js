import { defineConfig } from 'vitest/config';

// Backend tests use controlled test values, not real secrets from .env.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],

    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'error',
      JWT_SECRET: 'test-secret-test-secret-test-secret-123',
      GEMINI_API_KEY: 'test-gemini-key',
      GEMINI_MODEL: 'gemini-test-model',
      GEMINI_FALLBACK_MODEL: 'gemini-test-fallback',
      GEMINI_TIMEOUT_MS: '200',
      GEMINI_MAX_RETRIES: '1',
      DEFAULT_AI_PROVIDER: 'gemini',
      ANTHROPIC_API_KEY: '',
      MONGODB_URI: '',
      NOTIFY_WEBHOOK_URLS: '',
      NOTIFY_WEBHOOK_SECRET: '',
      RESEND_API_KEY: '',
      SMTP_HOST: '',
      VAPID_PUBLIC_KEY: '',
      VAPID_PRIVATE_KEY: '',
      VAPID_SUBJECT: '',
      CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
      BCRYPT_ROUNDS: '4',
      SKIP_DOTENV: 'true',
    },

    restoreMocks: true,
  },
});