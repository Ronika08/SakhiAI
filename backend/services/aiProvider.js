/**
 * services/aiProvider.js
 *
 * Provider-independent AI abstraction.
 *
 * Controllers (e.g. chatController) call `generateResponse()` here without
 * knowing which underlying AI vendor handles the request. This module owns
 * the mapping from a provider name -> a concrete service implementation
 * (anthropicService, openaiService, geminiService, ...).
 *
 * To add a new provider:
 *   1. Create services/<provider>Service.js exposing generateResponse().
 *   2. Register it in the `providers` map below.
 * No other file in the app needs to change.
 */

import config from '../config/index.js';
import { AppError } from '../middleware/errorHandler.js';
import anthropicService from './anthropicService.js';
import logger from '../utils/logger.js';
import geminiService from './geminiService.js';

/**
 * Placeholder for a provider that hasn't been implemented yet.
 * Keeps the registry complete (all three providers from the tech stack
 * are listed) while failing loudly and clearly if selected before its
 * service file exists.
 */
function notImplemented(providerName) {
  return {
    async generateResponse() {
      throw new AppError(`AI provider "${providerName}" is not yet implemented.`, 501, null, 'AI_UNAVAILABLE');
    },
  };
}

const providers = {
  anthropic: anthropicService,
  openai: notImplemented('openai'),
  gemini: geminiService,
};

/**
 * Resolves and invokes the correct AI service for a chat request.
 *
 * @param {Object} params
 * @param {Array<{role: string, content: string}>} params.messages - Full conversation, oldest first.
 * @param {string} [params.system] - System prompt override.
 * @param {number} [params.maxTokens] - Max output tokens override.
 * @param {string} [params.provider] - Explicit provider override.
 * @returns {Promise<{ reply: string, provider: string, usage: Object | null }>}
 */
async function generateResponse({ messages, system, maxTokens, provider }) {
  // Backend owns provider selection: the default comes from DEFAULT_AI_PROVIDER
  // (gemini unless overridden). Callers inside the backend may still pass an
  // explicit provider; HTTP clients cannot (see chatController).
  const providerName = String(provider || config.ai.defaultProvider || 'gemini').toLowerCase();
  const service = providers[providerName];

  if (!service) {
    throw new AppError(
      `Unknown AI provider "${providerName}". Valid options: ${Object.keys(providers).join(', ')}.`,
      400,
      null,
      'VALIDATION_ERROR'
    );
  }

  logger.debug(`Dispatching chat request to provider: ${providerName}`);

  // The model is intentionally NOT passed: each provider service reads its
  // model from backend configuration (GEMINI_MODEL, ANTHROPIC_MODEL, ...).
  return service.generateResponse({ messages, system, maxTokens });
}

export function listProviders() {
  return Object.keys(providers);
}

export default { generateResponse, listProviders };