/**
 * scripts/checkGemini.js   (npm run check:gemini)
 *
 * LIVE check of YOUR Gemini configuration using backend/.env. Makes ONE tiny
 * request through the same service the app uses and prints only the outcome —
 * never the API key. Run it yourself after adding GEMINI_API_KEY; CI never
 * runs this (no real keys in CI).
 */
import config from '../config/index.js';
import geminiService from '../services/geminiService.js';

const { model, fallbackModel, apiKey } = config.ai.gemini;
console.log(`Provider : ${config.ai.defaultProvider}`);
console.log(`Model    : ${model}${fallbackModel ? `  (fallback: ${fallbackModel})` : '  (no fallback)'}`);
console.log(`API key  : ${apiKey ? 'set' : 'NOT SET'}`);

if (!apiKey) {
  console.error('\n✖ GEMINI_API_KEY is not set in backend/.env');
  process.exit(1);
}

try {
  const started = Date.now();
  const result = await geminiService.generateResponse({
    messages: [{ role: 'user', content: 'Reply with the single word: ready' }],
    maxTokens: 64,
  });
  console.log(`\n✔ Gemini responded in ${Date.now() - started} ms using model "${result.model}"`);
  if (result.model !== model) console.log(`  ⚠ The primary model "${model}" failed; the fallback served this request. Update GEMINI_MODEL.`);
  process.exit(0);
} catch (err) {
  console.error(`\n✖ Gemini check failed: [${err.code || 'ERROR'}] ${err.message}`);
  const hints = {
    AI_UNAVAILABLE: 'Check GEMINI_API_KEY and that GEMINI_MODEL is a currently supported model name.',
    AI_RATE_LIMITED: 'Quota/rate limit reached for this key or model. Try again later or use another model.',
    AI_TIMEOUT: 'The request timed out. Check your network or raise GEMINI_TIMEOUT_MS.',
  };
  if (hints[err.code]) console.error(`  Hint: ${hints[err.code]}`);
  process.exit(1);
}
