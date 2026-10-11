/**
 * routes/notificationRoutes.js – mounted at `/api/notifications`.
 */

import { Router } from 'express';
import {
  getStatus,
  subscribePush,
  unsubscribePush,
  sendTest,
} from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';
import requireDb from '../middleware/requireDb.js';
import { sosLimiter } from '../middleware/rateLimiters.js';

const router = Router();

// Channel availability is not sensitive (booleans + public VAPID key).
router.get('/status', getStatus);

router.post('/push/subscribe', requireDb, protect, subscribePush);
router.delete('/push/subscribe', requireDb, protect, unsubscribePush);
router.post('/test', requireDb, protect, sosLimiter, sendTest);

export default router;
