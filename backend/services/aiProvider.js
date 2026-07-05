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

/**
 * Placeholder for a provider that hasn't been implemented yet.
 * Keeps the registry complete (all three providers from the tech stack
 * are listed) while failing loudly and clearly if selected before its
 * service file exists.
 */
function notImplemented(providerName) {
  return {
    async generateResponse() {
      throw new AppError(`AI provider "${providerName}" is not yet implemented.`, 501);
    },
  };
}

const providers = {
  anthropic: anthropicService,
  openai: notImplemented('openai'),
  gemini: notImplemented('gemini'),
};

/**
 * Resolves and invokes the correct AI service for a chat request.
 *
 * @param {Object} params
 * @param {string} params.message - The user's latest message.
 * @param {Array<{role: string, content: string}>} [params.history] - Prior turns.
 * @param {string} [params.provider] - Explicit provider override.
 * @returns {Promise<{ reply: string, provider: string }>}
 */
async function generateResponse({ message, history = [], provider }) {
  const providerName = (provider || config.ai.defaultProvider || 'anthropic').toLowerCase();
  const service = providers[providerName];

  if (!service) {
    throw new AppError(
      `Unknown AI provider "${providerName}". Valid options: ${Object.keys(providers).join(', ')}.`,
      400
    );
  }

  logger.info(`Dispatching chat request to provider: ${providerName}`);

  return service.generateResponse({ message, history });
}

export default { generateResponse };
