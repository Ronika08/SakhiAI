/**
 * routes/voiceRoutes.js – mounted at `/api/voice`.
 * Public (anonymous users can use voice) but strictly rate limited.
 */
import express, { Router } from 'express';
import { getStatus, transcribe } from '../controllers/voiceController.js';
import { voiceLimiter } from '../middleware/rateLimiters.js';
import { optionalAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/status', getStatus);
// Audio needs a larger body (up to ~2 MB of base64) than the global 100 KB JSON limit; scoped to this route only.
router.post('/transcribe', voiceLimiter, optionalAuth, express.json({ limit: '3mb' }), transcribe);

export default router;
