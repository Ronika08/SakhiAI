/**
 * routes/safetyCheckInRoutes.js
 *
 * Route definitions for the Safety Check-In feature. Mounted at
 * `/api/checkins` by routes/index.js. Every route requires authentication
 * since check-ins are always scoped to the logged-in user.
 */

import { Router } from 'express';
import {
  createCheckIn,
  getCheckIns,
  getCheckIn,
  confirmCheckIn,
  cancelCheckIn,
} from '../controllers/safetyCheckInController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

// All safety check-in routes require an authenticated user.
router.use(protect);

/**
 * POST /api/checkins
 * Start a new safety check-in.
 */
router.post('/', createCheckIn);

/**
 * GET /api/checkins
 * List the current user's check-ins.
 */
router.get('/', getCheckIns);

/**
 * GET /api/checkins/:id
 * Fetch a single check-in.
 */
router.get('/:id', getCheckIn);

/**
 * PATCH /api/checkins/:id/confirm
 * Confirm safe arrival.
 */
router.patch('/:id/confirm', confirmCheckIn);

/**
 * PATCH /api/checkins/:id/cancel
 * Cancel a pending check-in.
 */
router.patch('/:id/cancel', cancelCheckIn);

export default router;
