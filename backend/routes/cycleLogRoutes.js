/**
 * routes/cycleLogRoutes.js
 *
 * Route definitions for the Period Cycle Tracker feature. Mounted at
 * `/api/cycles` by routes/index.js. Every route requires authentication
 * since cycle logs are always scoped to the logged-in user.
 */

import { Router } from 'express';
import {
  createLog,
  getLogs,
  getPrediction,
  getLog,
  updateLog,
  deleteLog,
} from '../controllers/cycleLogController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

// All cycle tracker routes require an authenticated user.
router.use(protect);

/**
 * POST /api/cycles
 * Log a new cycle entry.
 */
router.post('/', createLog);

/**
 * GET /api/cycles
 * List the current user's cycle logs.
 */
router.get('/', getLogs);

/**
 * GET /api/cycles/predict
 * Predict the next expected period start date.
 * Declared before "/:id" so "predict" isn't captured as an id param.
 */
router.get('/predict', getPrediction);

/**
 * GET /api/cycles/:id
 * Fetch a single cycle log.
 */
router.get('/:id', getLog);

/**
 * PATCH /api/cycles/:id
 * Update a cycle log.
 */
router.patch('/:id', updateLog);

/**
 * DELETE /api/cycles/:id
 * Delete a cycle log.
 */
router.delete('/:id', deleteLog);

export default router;
