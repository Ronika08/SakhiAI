/**
 * routes/healthKnowledgeRoutes.js
 *
 * Route definitions for the Health Knowledge Base / Health Tips feature.
 * Mounted at `/api/health-tips` by routes/index.js. Public/read-only —
 * no authentication required.
 */

import { Router } from 'express';
import { getTips, searchTips, getTip } from '../controllers/healthKnowledgeController.js';

const router = Router();

/**
 * GET /api/health-tips
 * List health tips, optionally filtered by category.
 */
router.get('/', getTips);

/**
 * GET /api/health-tips/search
 * Search health tips by free-text query.
 * Declared before "/:id" so "search" isn't captured as an id param.
 */
router.get('/search', searchTips);

/**
 * GET /api/health-tips/:id
 * Fetch a single health tip.
 */
router.get('/:id', getTip);

export default router;
