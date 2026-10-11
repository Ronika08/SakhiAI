/**
 * routes/chatRoutes.js
 *
 * Route definitions for the AI chat feature. Mounted at `/api/chat`
 * by routes/index.js. Chat remains PUBLIC (anonymous users can chat) but is
 * rate limited; an authenticated user, if present, is attached for logging.
 */

import { Router } from 'express';
import { sendMessage } from '../controllers/chatController.js';
import { optionalAuth } from '../middleware/authMiddleware.js';
import { chatLimiter } from '../middleware/rateLimiters.js';

const router = Router();

/**
 * POST /api/chat
 * Send a message to the AI assistant and receive a reply.
 */
router.post('/', chatLimiter, optionalAuth, sendMessage);

export default router;
