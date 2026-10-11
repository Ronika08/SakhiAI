/**
 * routes/safeRouteRoutes.js
 *
 * Route definitions for the Safe Route Planning feature. Mounted at
 * `/api/routes` by routes/index.js. Requires authentication since route
 * planning is tied to a user's trip context.
 */

import { Router } from 'express';
import { planRoute } from '../controllers/safeRouteController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

router.use(protect);

/**
 * POST /api/routes/plan
 * Plan a route between an origin and destination.
 */
router.post('/plan', planRoute);

export default router;
