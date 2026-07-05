/**
 * routes/emergencySOSRoutes.js
 *
 * Route definitions for the Emergency SOS feature. Mounted at `/api/sos`
 * by routes/index.js. Every route requires authentication since SOS
 * events are always scoped to the logged-in user.
 */

import { Router } from 'express';
import { createSOS, getSOSEvents, getSOSEvent } from '../controllers/emergencySOSController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

// All SOS routes require an authenticated user.
router.use(protect);

/**
 * POST /api/sos
 * Trigger a new Emergency SOS event.
 */
router.post('/', createSOS);

/**
 * GET /api/sos
 * List the current user's past SOS events.
 */
router.get('/', getSOSEvents);

/**
 * GET /api/sos/:id
 * Fetch a single SOS event.
 */
router.get('/:id', getSOSEvent);

export default router;
