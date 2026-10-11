/**
 * routes/emergencySOSRoutes.js
 *
 * Route definitions for SOS events. Mounted at `/api/sos`.
 * All routes require authentication (SOS notifications act on the user's
 * saved Trusted Circle). Anonymous users keep the existing device-based
 * SMS / WhatsApp / call flow in the frontend.
 */

import { Router } from 'express';
import {
  createSOS,
  getSOSEvents,
  getSOSEvent,
  resolveSOS,
  cancelSOS,
} from '../controllers/emergencySOSController.js';
import { protect } from '../middleware/authMiddleware.js';
import { sosLimiter } from '../middleware/rateLimiters.js';

const router = Router();

router.use(protect);

/** POST /api/sos – trigger an SOS event */
router.post('/', sosLimiter, createSOS);

/** GET /api/sos – list the user's SOS events */
router.get('/', getSOSEvents);

/** GET /api/sos/:id – single event with delivery details */
router.get('/:id', getSOSEvent);

/** POST /api/sos/:id/resolve – "I'm safe" (optionally notify contacts) */
router.post('/:id/resolve', resolveSOS);

/** POST /api/sos/:id/cancel – cancel an event */
router.post('/:id/cancel', cancelSOS);

export default router;
