/**
 * controllers/cycleLogController.js
 *
 * HTTP layer for the Period Cycle Tracker feature. All routes here run
 * behind the `protect` auth middleware, so `req.user.id` is always
 * available. Validation of request bodies happens here; ownership rules,
 * persistence, and prediction math live in services/cycleLogService.js.
 */

import { AppError } from '../middleware/errorHandler.js';
import cycleLogService from '../services/cycleLogService.js';

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const FLOW_LEVELS = ['spotting', 'light', 'medium', 'heavy'];
const SYMPTOM_OPTIONS = [
  'cramps',
  'headache',
  'bloating',
  'fatigue',
  'backache',
  'nausea',
  'acne',
  'tender_breasts',
  'mood_swings',
  'food_cravings',
];

/**
 * Validates the subset of log fields present in the request body.
 * Used by both create (startDate required) and update (all optional).
 */
function validateLogFields(body, { requireStartDate }) {
  const { startDate, endDate, cycleLengthDays, flow, symptoms, mood, notes } = body;

  if (requireStartDate && !startDate) {
    throw new AppError('Field "startDate" is required.', 400);
  }

  if (cycleLengthDays !== undefined && cycleLengthDays !== null) {
    if (typeof cycleLengthDays !== 'number' || cycleLengthDays < 10 || cycleLengthDays > 90) {
      throw new AppError('Field "cycleLengthDays" must be a number between 10 and 90.', 400);
    }
  }

  if (flow !== undefined && flow !== null && !FLOW_LEVELS.includes(flow)) {
    throw new AppError(`Field "flow" must be one of: ${FLOW_LEVELS.join(', ')}.`, 400);
  }

  if (symptoms !== undefined) {
    if (!Array.isArray(symptoms) || symptoms.some((s) => !SYMPTOM_OPTIONS.includes(s))) {
      throw new AppError(`Field "symptoms" must be an array from: ${SYMPTOM_OPTIONS.join(', ')}.`, 400);
    }
  }

  if (mood !== undefined && mood !== null && typeof mood !== 'string') {
    throw new AppError('Field "mood" must be a string.', 400);
  }

  if (notes !== undefined && notes !== null && typeof notes !== 'string') {
    throw new AppError('Field "notes" must be a string.', 400);
  }

  return {
    ...(startDate !== undefined && { startDate }),
    ...(endDate !== undefined && { endDate }),
    ...(cycleLengthDays !== undefined && { cycleLengthDays }),
    ...(flow !== undefined && { flow }),
    ...(symptoms !== undefined && { symptoms }),
    ...(mood !== undefined && { mood }),
    ...(notes !== undefined && { notes }),
  };
}

/**
 * POST /api/cycles
 */
export const createLog = asyncHandler(async (req, res) => {
  const data = validateLogFields(req.body, { requireStartDate: true });
  const log = await cycleLogService.createLog(req.user.id, data);
  res.status(201).json({ success: true, data: { log } });
});

/**
 * GET /api/cycles
 */
export const getLogs = asyncHandler(async (req, res) => {
  const logs = await cycleLogService.listLogs(req.user.id);
  res.status(200).json({ success: true, data: { logs } });
});

/**
 * GET /api/cycles/predict
 * Returns the predicted next period start date based on cycle history.
 * Defined before the "/:id" route at the router level to avoid "predict"
 * being mistaken for an id.
 */
export const getPrediction = asyncHandler(async (req, res) => {
  const prediction = await cycleLogService.predictNextCycle(req.user.id);
  res.status(200).json({ success: true, data: { prediction } });
});

/**
 * GET /api/cycles/:id
 */
export const getLog = asyncHandler(async (req, res) => {
  const log = await cycleLogService.getLog(req.user.id, req.params.id);
  res.status(200).json({ success: true, data: { log } });
});

/**
 * PATCH /api/cycles/:id
 */
export const updateLog = asyncHandler(async (req, res) => {
  const updates = validateLogFields(req.body, { requireStartDate: false });

  if (Object.keys(updates).length === 0) {
    throw new AppError('At least one field must be provided to update.', 400);
  }

  const log = await cycleLogService.updateLog(req.user.id, req.params.id, updates);
  res.status(200).json({ success: true, data: { log } });
});

/**
 * DELETE /api/cycles/:id
 */
export const deleteLog = asyncHandler(async (req, res) => {
  await cycleLogService.deleteLog(req.user.id, req.params.id);
  res.status(200).json({ success: true, message: 'Cycle log deleted.' });
});

export default { createLog, getLogs, getPrediction, getLog, updateLog, deleteLog };
