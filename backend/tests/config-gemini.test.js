import { describe, it, expect, vi } from 'vitest';

async function loadConfig(env) {
  vi.resetModules();

  const keys = [
    'GEMINI_MODEL',
    'GEMINI_FALLBACK_MODEL',
    'GEMINI_API_KEY',
    'DEFAULT_AI_PROVIDER',
    'NODE_ENV',
    'JWT_SECRET',
    'MONGODB_URI',
    'GEMINI_TIMEOUT_MS',
    'SKIP_DOTENV',
  ];

  for (const key of keys) {
    delete process.env[key];
  }

  Object.assign(process.env, {
    NODE_ENV: 'test',
    JWT_SECRET: 'x'.repeat(40),
    SKIP_DOTENV: 'true',
    ...env,
  });

  return (await import('../config/index.js')).default;
}

describe('Gemini configuration handling', () => {
  it('defaults: Gemini is the primary provider with the expected models and timeout', async () => {
    const c = await loadConfig({ GEMINI_API_KEY: 'test-key' });

    expect(c.ai.defaultProvider).toBe('gemini');
    expect(c.ai.gemini.model).toBe('gemini-3.5-flash');
    expect(c.ai.gemini.fallbackModel).toBe('gemini-3.1-flash-lite');
    expect(c.ai.gemini.timeoutMs).toBe(20000);
    expect(c.ai.gemini.model).not.toMatch(/1\.5|2\.0|2\.5/);
  });

  it('model comes only from the backend environment', async () => {
    const c = await loadConfig({
      GEMINI_API_KEY: 'test-key',
      GEMINI_MODEL: 'gemini-custom-1',
    });

    expect(c.ai.gemini.model).toBe('gemini-custom-1');
  });

  it('rejects a malicious model name', async () => {
    const c = await loadConfig({
      GEMINI_API_KEY: 'test-key',
      GEMINI_MODEL: '../../v1/other:evil?x=',
    });

    expect(c.ai.gemini.model).toBe('gemini-3.5-flash');
  });

  it('an empty fallback model disables the fallback', async () => {
    const c = await loadConfig({
      GEMINI_API_KEY: 'test-key',
      GEMINI_FALLBACK_MODEL: '',
    });

    expect(c.ai.gemini.fallbackModel).toBe('');
  });

  it('invalid numeric settings fall back to defaults', async () => {
    const c = await loadConfig({
      GEMINI_API_KEY: 'test-key',
      GEMINI_TIMEOUT_MS: 'abc',
    });

    expect(c.ai.gemini.timeoutMs).toBe(20000);
  });

  it('production refuses to start with Gemini as provider but no key', async () => {
    await expect(
      loadConfig({ NODE_ENV: 'production' }),
    ).rejects.toThrow(/GEMINI_API_KEY/);
  });

  it('keeps the API key in backend configuration, not VITE environment variables', async () => {
    const c = await loadConfig({
      GEMINI_API_KEY: 'test-secret-value',
    });

    expect(c.ai.gemini.apiKey).toBe('test-secret-value');

    expect(
      JSON.stringify(
        Object.keys(process.env).filter((key) => key.startsWith('VITE_')),
      ),
    ).not.toMatch(/GEMINI/);
  });

  it('defaults to Gemini but respects an explicitly selected provider', async () => {
    const defaultConfig = await loadConfig({
      GEMINI_API_KEY: 'test-key',
    });

    expect(defaultConfig.ai.defaultProvider).toBe('gemini');

    const alternateConfig = await loadConfig({
      GEMINI_API_KEY: 'test-key',
      DEFAULT_AI_PROVIDER: 'anthropic',
    });

    expect(alternateConfig.ai.defaultProvider).toBe('anthropic');
  });
});