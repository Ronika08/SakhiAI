/**
 * controllers/chatController.js
 *
 * Handles HTTP request/response concerns for the AI chat feature.
 *
 * This controller stays thin on purpose: it validates input, delegates
 * the actual AI call to `services/aiProvider.js` (which abstracts over
 * Anthropic/OpenAI/Gemini), and shapes the response. No provider-specific
 * logic should ever live here — that keeps the backend provider-independent,
 * per the project's architecture rules.
 */

import { AppError } from '../middleware/errorHandler.js';
import aiProvider from '../services/aiProvider.js';
import logger from '../utils/logger.js';

/**
 * Wraps an async route handler so thrown/rejected errors are forwarded
 * to Express's error-handling middleware instead of crashing the process
 * or requiring a try/catch in every controller.
 */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/**
 * POST /api/chat
 *
 * Request body:
 *   {
 *     "message": string,          // required, the user's chat message
 *     "history": [                // optional, prior turns for context
 *       { "role": "user" | "assistant", "content": string }
 *     ],
 *     "provider": string          // optional, "anthropic" | "openai" | "gemini"
 *   }
 *
 * Response body:
 *   {
 *     "success": true,
 *     "data": {
 *       "reply": string,
 *       "provider": string
 *     }
 *   }
 */
export const sendMessage = asyncHandler(async (req, res) => {
  const { message, history, provider } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    throw new AppError('Field "message" is required and must be a non-empty string.', 400);
  }

  if (history !== undefined && !Array.isArray(history)) {
    throw new AppError('Field "history" must be an array when provided.', 400);
  }

  logger.info(`Chat request received (provider=${provider || 'default'})`);

  const result = await aiProvider.generateResponse({
    message: message.trim(),
    history: history || [],
    provider,
  });

  res.status(200).json({
    success: true,
    data: {
      reply: result.reply,
      provider: result.provider,
    },
  });
});

export default { sendMessage };
