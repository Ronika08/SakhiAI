/**
 * controllers/chatController.js
 *
 * HTTP layer for the AI chat fallback (the last step of the hybrid flow:
 * Rule Engine → Intent Engine → THIS endpoint → aiProvider → Gemini).
 *
 * The controller stays thin and provider-agnostic: it never mentions
 * Gemini/Anthropic. All AI configuration (provider, model, system prompt,
 * token limits) is owned by the backend:
 *   - request fields `system`, `model`, `provider` and `max_tokens` from older
 *     clients are accepted for backward compatibility but IGNORED.
 *
 * Request:   POST /api/chat  { messages: [{ role: "user"|"assistant", content }], language?: "en"|"hi"|"kn" }
 *             `language` only selects the reply language; it cannot change the model.
 * Success:   { success: true, response, provider, usage, error: null, safety }
 * Failure:   { success: false, response: null, provider: null, usage: null,
 *              error, code, fallbackResponse, requestId }
 *
 * `provider` is "safety-engine" when a vetted safety response was returned
 * without calling any AI model.
 */

import aiProvider from '../services/aiProvider.js';
import chatSafety from '../services/chatSafetyService.js';
import logger from '../utils/logger.js';
import config from '../config/index.js';

/**
 * Wraps an async route handler so rejected promises reach the error handler.
 */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function statusFor(error) {
  return Number.isInteger(error?.statusCode) ? error.statusCode : 500;
}

export const sendMessage = asyncHandler(async (req, res) => {
  const started = Date.now();

  try {
    const language = chatSafety.normalizeLanguage(req.body?.language);
    const { conversation, lastUserMessage } = chatSafety.prepareConversation(req.body?.messages);

    // 1. Safety screening BEFORE any AI call.
    const assessment = chatSafety.assessMessage(lastUserMessage, language);
    if (assessment.category) {
      req.aiProvider = 'safety-engine';
      logger.warn(`Chat safety category triggered: ${assessment.category}`);
      return res.status(200).json({
        success: true,
        response: assessment.reply,
        provider: 'safety-engine',
        usage: null,
        error: null,
        safety: { category: assessment.category, aiCalled: false },
      });
    }

    // 2. AI call through the provider abstraction (model/system are backend-owned).
    const result = await aiProvider.generateResponse({
      messages: conversation,
      system: chatSafety.buildSystemPrompt(language),
      maxTokens: config.ai.maxOutputTokens,
    });
    req.aiProvider = result.provider;

    // 3. Validate the AI output before returning it.
    const validated = chatSafety.validateReply(result.reply);
    if (validated.modified) {
      logger.warn(`AI reply modified by safety validation: ${validated.flags.join(',')}`);
    }

    logger.info(
      `Chat answered provider=${result.provider} messages=${conversation.length} ` +
        `chars=${validated.reply.length} durationMs=${Date.now() - started}`
    );

    return res.status(200).json({
      success: true,
      response: validated.reply,
      provider: result.provider,
      usage: result.usage,
      error: null,
      safety: { category: null, aiCalled: true, flags: validated.flags },
    });
  } catch (error) {
    const statusCode = statusFor(error);
    const code = error?.code && typeof error.code === 'string' ? error.code : 'SERVER_ERROR';
    const isOperational = error?.isOperational === true;

    logger.error(`POST /api/chat failed -> ${statusCode} [${code}] ${error?.message}`);

    const isAiFailure = code.startsWith('AI_');
    return res.status(statusCode).json({
      success: false,
      response: null,
      provider: null,
      usage: null,
      error: isOperational ? error.message : 'Something went wrong on our side. Please try again.',
      code,
      // Safe, user-friendly text the UI can show instead of a raw error.
      fallbackResponse: isAiFailure ? chatSafety.fallbackFor(code, chatSafety.normalizeLanguage(req.body?.language)) : null,
      requestId: req.id || null,
    });
  }
});

export default { sendMessage };
