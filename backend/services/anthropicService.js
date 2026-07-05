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

// System prompt establishing SakhiAI's persona and safety boundaries.
const SYSTEM_PROMPT = `You are Sakhi, the AI health and safety companion inside the SakhiAI app.
You help users with women's health, wellness, and safety questions in a warm,
clear, and respectful tone. You are not a doctor: for urgent medical concerns
or emergencies, encourage the user to contact a medical professional or local
emergency services. Keep answers concise and practical.`;

/**
 * Converts the app's generic { role, content } history into Anthropic's
 * expected message format. Anthropic only accepts "user" and "assistant"
 * roles inside `messages`; the system prompt is passed separately.
 */
function toAnthropicMessages(history, message) {
  const messages = (history || [])
    .filter((turn) => turn && (turn.role === 'user' || turn.role === 'assistant') && turn.content)
    .map((turn) => ({ role: turn.role, content: turn.content }));

  messages.push({ role: 'user', content: message });
  return messages;
}

/**
 * Calls the Anthropic Messages API and returns the assistant's reply text.
 *
 * @param {Object} params
 * @param {string} params.message - The latest user message.
 * @param {Array<{role: string, content: string}>} [params.history] - Prior turns.
 * @returns {Promise<{ reply: string, provider: string }>}
 */
async function generateResponse({ message, history = [] }) {
  const { apiKey, model } = config.ai.anthropic;

  if (!apiKey) {
    throw new AppError('Anthropic API key is not configured on the server.', 503);
  }

  const payload = {
    model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: toAnthropicMessages(history, message),
  };

  let response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify(payload),
    });
  } catch (networkError) {
    logger.error(`Anthropic request failed: ${networkError.message}`);
    throw new AppError('Unable to reach the Anthropic API. Please try again.', 502);
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const providerMessage = data?.error?.message || 'Unknown error from Anthropic API.';
    logger.error(`Anthropic API error (${response.status}): ${providerMessage}`);
    throw new AppError(`AI provider error: ${providerMessage}`, response.status >= 500 ? 502 : 400);
  }

  const textBlock = Array.isArray(data?.content)
    ? data.content.find((block) => block.type === 'text')
    : null;

  if (!textBlock?.text) {
    logger.error('Anthropic API returned no usable text content.');
    throw new AppError('AI provider returned an empty response.', 502);
  }

  return {
    reply: textBlock.text,
    provider: 'anthropic',
  };
}

export default { generateResponse };
