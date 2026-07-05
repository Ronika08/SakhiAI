/**
 * routes/moodLogRoutes.js
 *
 * Route definitions for the Mood Tracker feature. Mounted at `/api/moods`
 * by routes/index.js. Every route requires authentication since mood
 * logs are always scoped to the logged-in user.
 */

import { Router } from 'express';
import {
  createLog,
  getLogs,
  getSummary,
  getLog,
  updateLog,
  deleteLog,
} from '../controllers/moodLogController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

// All mood tracker routes require an authenticated user.
router.use(protect);

/**
 * POST /api/moods
 * Log a new mood entry.
 */
router.post('/', createLog);

/**
 * GET /api/moods
 * List the current user's mood logs (optionally filtered by date range).
 */
router.get('/', getLogs);

/**
 * GET /api/moods/summary
 * Mood frequency breakdown over a recent period.
 * Declared before "/:id" so "summary" isn't captured as an id param.
 */
router.get('/summary', getSummary);

/**
 * GET /api/moods/:id
 * Fetch a single mood log.
 */
router.get('/:id', getLog);

/**
 * PATCH /api/moods/:id
 * Update a mood log.
 */
router.patch('/:id', updateLog);

/**
 * DELETE /api/moods/:id
 * Delete a mood log.
 */
router.delete('/:id', deleteLog);

export default router;
