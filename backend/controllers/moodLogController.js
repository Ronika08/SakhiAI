/**
 * controllers/moodLogController.js
 *
 * HTTP layer for the Mood Tracker feature. All routes here run behind
 * the `protect` auth middleware, so `req.user.id` is always available.
 * Validation of request bodies happens here; ownership rules and
 * persistence live in services/moodLogService.js.
 */

import { AppError } from '../middleware/errorHandler.js';
import moodLogService from '../services/moodLogService.js';

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const MOOD_VALUES = [
  'happy',
  'calm',
  'energetic',
  'neutral',
  'tired',
  'anxious',
  'sad',
  'irritable',
  'stressed',
];

/**
 * Validates the subset of mood log fields present in the request body.
 * Used by both create (mood required) and update (all optional).
 */
function validateLogFields(body, { requireMood }) {
  const { mood, intensity, loggedDate, note, tags } = body;

  if (requireMood || mood !== undefined) {
    if (!mood || !MOOD_VALUES.includes(mood)) {
      throw new AppError(`Field "mood" must be one of: ${MOOD_VALUES.join(', ')}.`, 400);
    }
  }

  if (intensity !== undefined && intensity !== null) {
    if (typeof intensity !== 'number' || intensity < 1 || intensity > 5) {
      throw new AppError('Field "intensity" must be a number between 1 and 5.', 400);
    }
  }

  if (note !== undefined && note !== null && typeof note !== 'string') {
    throw new AppError('Field "note" must be a string.', 400);
  }

  if (tags !== undefined) {
    if (!Array.isArray(tags) || tags.some((t) => typeof t !== 'string')) {
      throw new AppError('Field "tags" must be an array of strings.', 400);
    }
  }

  return {
    ...(mood !== undefined && { mood }),
    ...(intensity !== undefined && { intensity }),
    ...(loggedDate !== undefined && { loggedDate }),
    ...(note !== undefined && { note }),
    ...(tags !== undefined && { tags }),
  };
}

/**
 * POST /api/moods
 */
export const createLog = asyncHandler(async (req, res) => {
  const data = validateLogFields(req.body, { requireMood: true });
  const log = await moodLogService.createLog(req.user.id, data);
  res.status(201).json({ success: true, data: { log } });
});

/**
 * GET /api/moods
 * Query params: from?, to? (ISO date strings) for optional range filtering.
 */
export const getLogs = asyncHandler(async (req, res) => {
  const { from, to } = req.query;

  const range = {};
  if (from) {
    const fromDate = new Date(from);
    if (Number.isNaN(fromDate.getTime())) {
      throw new AppError('Query param "from" must be a valid date.', 400);
    }
    range.from = fromDate;
  }
  if (to) {
    const toDate = new Date(to);
    if (Number.isNaN(toDate.getTime())) {
      throw new AppError('Query param "to" must be a valid date.', 400);
    }
    range.to = toDate;
  }

  const logs = await moodLogService.listLogs(req.user.id, range);
  res.status(200).json({ success: true, data: { logs } });
});

/**
 * GET /api/moods/summary
 * Query params: days? (defaults to 30)
 * Declared before "/:id" at the router level so "summary" isn't captured
 * as an id param.
 */
export const getSummary = asyncHandler(async (req, res) => {
  const days = req.query.days ? parseInt(req.query.days, 10) : 30;

  if (Number.isNaN(days) || days <= 0) {
    throw new AppError('Query param "days" must be a positive number.', 400);
  }

  const summary = await moodLogService.getMoodSummary(req.user.id, days);
  res.status(200).json({ success: true, data: { summary } });
});

/**
 * GET /api/moods/:id
 */
export const getLog = asyncHandler(async (req, res) => {
  const log = await moodLogService.getLog(req.user.id, req.params.id);
  res.status(200).json({ success: true, data: { log } });
});

/**
 * PATCH /api/moods/:id
 */
export const updateLog = asyncHandler(async (req, res) => {
  const updates = validateLogFields(req.body, { requireMood: false });

  if (Object.keys(updates).length === 0) {
    throw new AppError('At least one field must be provided to update.', 400);
  }

  const log = await moodLogService.updateLog(req.user.id, req.params.id, updates);
  res.status(200).json({ success: true, data: { log } });
});

/**
 * DELETE /api/moods/:id
 */
export const deleteLog = asyncHandler(async (req, res) => {
  await moodLogService.deleteLog(req.user.id, req.params.id);
  res.status(200).json({ success: true, message: 'Mood log deleted.' });
});

export default { createLog, getLogs, getSummary, getLog, updateLog, deleteLog };
