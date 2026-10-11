/**
 * scripts/validateEnv.js
 *
 * `npm run validate:env` – checks backend environment variables and prints a
 * report. Never prints secret VALUES — only whether each is set. Exits 1 on
 * errors (so CI/deploy pipelines can fail fast).
 */
import config from '../config/index.js';

const errors = [];
const warnings = [];
const ok = [];

const check = (cond, okMsg, failList, failMsg) => (cond ? ok.push(okMsg) : failList.push(failMsg));

check(config.auth.jwtSecret.length >= 32, 'JWT_SECRET set (≥32 chars)', errors, 'JWT_SECRET must be ≥32 characters');
check(Boolean(config.database.mongoUri), 'MONGODB_URI set', errors, 'MONGODB_URI is not set');

const provider = config.ai.defaultProvider;
check(['gemini', 'anthropic', 'openai'].includes(provider), `DEFAULT_AI_PROVIDER=${provider}`, errors, `Unknown DEFAULT_AI_PROVIDER "${provider}"`);
if (provider === 'gemini') {
  check(Boolean(config.ai.gemini.apiKey), 'GEMINI_API_KEY set', errors, 'GEMINI_API_KEY is not set');
  ok.push(`GEMINI_MODEL=${config.ai.gemini.model}`);
}
check(Boolean(config.maps.apiKey), 'GOOGLE_MAPS_API_KEY set (Safe Route)', warnings, 'GOOGLE_MAPS_API_KEY not set – server-side route planning disabled');
check(config.cors.allowedOrigins.every((o) => /^https?:\/\//.test(o)), 'CORS origins look valid', errors, 'CORS_ALLOWED_ORIGINS has an invalid entry');
if (config.isProduction) {
  check(!config.cors.allowedOrigins.some((o) => o.includes('localhost')), 'CORS has no localhost', warnings, 'CORS_ALLOWED_ORIGINS includes localhost in production');
  check(config.trustProxy > 0, 'TRUST_PROXY set', warnings, 'TRUST_PROXY not set – rate limiting sees the proxy IP behind a load balancer');
}

const n = config.notifications;
const channels = [];
if (n.webPush.publicKey && n.webPush.privateKey && n.webPush.subject) channels.push('webpush');
if ((n.resend.apiKey && n.resend.from) || (n.smtp.host && n.smtp.from)) channels.push('email');
if (n.webhook.urls.length) channels.push('webhook');
if (channels.length) ok.push(`SOS notification channels: ${channels.join(', ')}`);
else warnings.push('No SOS notification channel configured – SOS will honestly report NOT_CONFIGURED');

ok.forEach((m) => console.log(`  ✔ ${m}`));
warnings.forEach((m) => console.log(`  ⚠ ${m}`));
errors.forEach((m) => console.log(`  ✖ ${m}`));
process.exit(errors.length ? 1 : 0);
