/**
 * services/anthropicService.js
 *
 * Thin wrapper around the Anthropic Messages API.
 *
 * This module is intentionally the ONLY place in the backend that knows
 * about Anthropic's request/response shape. `services/aiProvider.js`
 * calls `generateResponse()` here without knowing (or caring) that it's
 * Anthropic under the hood — that's what keeps the backend provider-
 * independent. If Anthropic's API changes, only this file changes.
 */

import config from '../config/index.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_VERSION = '2023-06-01';
const DEFAULT_MAX_TOKENS = 1024;

// Default system prompt establishing SakhiAI's persona and safety boundaries.
// Callers may override this per-request (e.g. the frontend sends its own
// SYSTEM_PROMPT); this is only used when no override is provided.
const DEFAULT_SYSTEM_PROMPT = `You are Sakhi, the AI health and safety companion inside the SakhiAI app.
You help users with women's health, wellness, and safety questions in a warm,
clear, and respectful tone. You are not a doctor: for urgent medical concerns
or emergencies, encourage the user to contact a medical professional or local
emergency services. Keep answers concise and practical.`;

/**
 * Calls the Anthropic Messages API and returns the assistant's reply text.
 *
 * The caller (aiProvider.js) is responsible for supplying the full
 * conversation as `messages` (already in Anthropic's { role, content }
 * shape) — this service no longer merges history + latest message itself,
 * since the request now carries the whole conversation directly.
 *
 * @param {Object} params
 * @param {Array<{role: string, content: string}>} params.messages - Full conversation, oldest first.
 * @param {string} [params.system] - System prompt override.
 * @param {string} [params.model] - Model override.
 * @param {number} [params.maxTokens] - Max output tokens override.
 * @returns {Promise<{ reply: string, provider: string, usage: { input_tokens: number, output_tokens: number } }>}
 */
async function generateResponse({ messages, system, maxTokens }) {
  const { apiKey, model: defaultModel } = config.ai.anthropic;

  if (!apiKey) {
    throw new AppError('The AI service is not configured.', 503, null, 'AI_UNAVAILABLE');
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new AppError('At least one message is required.', 400);
  }

  const payload = {
    model: defaultModel,
    max_tokens: Math.min(maxTokens || DEFAULT_MAX_TOKENS, config.ai.maxOutputTokens),
    system: system || DEFAULT_SYSTEM_PROMPT,
    messages,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.ai.gemini.timeoutMs);

  let response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      signal: controller.signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify(payload),
    });
  } catch (networkError) {
    clearTimeout(timer);
    logger.error(`Anthropic request failed: ${networkError.message}`);
    if (networkError.name === 'AbortError') {
      throw new AppError('The AI service took too long to respond.', 504, null, 'AI_TIMEOUT');
    }
    throw new AppError('Unable to reach the AI service. Please try again.', 502, null, 'AI_UNAVAILABLE');
  }

  const data = await response.json().catch(() => null);
  clearTimeout(timer);

  if (!response.ok) {
    const providerMessage = data?.error?.message || 'Unknown error from Anthropic API.';
    logger.error(`Anthropic API error (${response.status}): ${providerMessage}`);
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      throw new AppError('The AI service is not configured correctly.', 503, null, 'AI_UNAVAILABLE');
    }
    if (response.status === 429) {
      throw new AppError('The AI service is busy right now. Please try again in a moment.', 429, null, 'AI_RATE_LIMITED');
    }
    throw new AppError('Unable to reach the AI service. Please try again.', 502, null, 'AI_UNAVAILABLE');
  }

  const textBlock = Array.isArray(data?.content)
    ? data.content.find((block) => block.type === 'text')
    : null;

  if (!textBlock?.text) {
    logger.error('Anthropic API returned no usable text content.');
    throw new AppError('The AI returned an empty response.', 502, null, 'AI_BAD_RESPONSE');
  }

  return {
    reply: textBlock.text,
    provider: 'anthropic',
    usage: data?.usage || null,
  };
}

export default { generateResponse };