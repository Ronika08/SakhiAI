/**
 * routes/chatRoutes.js
 *
 * Route definitions for the AI chat feature. Mounted at `/api/chat`
 * by routes/index.js. Keeps HTTP verb/path mapping separate from the
 * controller logic itself.
 */

import { Router } from 'express';
import { sendMessage } from '../controllers/chatController.js';

const router = Router();

/**
 * POST /api/chat
 * Send a message to the AI assistant and receive a reply.
 */
router.post('/', sendMessage);

export default router;
