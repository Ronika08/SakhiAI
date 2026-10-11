/**
 * controllers/wellnessLogController.js – HTTP layer for daily wellness.
 */

import { AppError } from '../middleware/errorHandler.js';
import wellnessLogService from '../services/wellnessLogService.js';
import { WELLNESS_SLEEP_BUCKETS } from '../models/WellnessLog.js';

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const vErr = (m) => new AppError(m, 400, null, 'VALIDATION_ERROR');

function numberIn(body, key, lo, hi, { integer = false } = {}) {
  const v = body[key];
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi || (integer && !Number.isInteger(v))) {
    throw vErr(`Field "${key}" must be ${integer ? 'a whole ' : 'a '}number from ${lo} to ${hi}.`);
  }
  return v;
}

function parseBody(body) {
  const data = {
    waterGlasses: numberIn(body, 'waterGlasses', 0, 30, { integer: true }),
    sleepHours: numberIn(body, 'sleepHours', 0, 24),
    activityMinutes: numberIn(body, 'activityMinutes', 0, 1440),
    stressLevel: numberIn(body, 'stressLevel', 1, 5, { integer: true }),
  };
  if (body.sleepBucket !== undefined) {
    if (body.sleepBucket !== null && !WELLNESS_SLEEP_BUCKETS.includes(body.sleepBucket)) {
      throw vErr(`Field "sleepBucket" must be one of: ${WELLNESS_SLEEP_BUCKETS.join(', ')}.`);
    }
    data.sleepBucket = body.sleepBucket;
  }
  for (const key of ['mood', 'note']) {
    if (body[key] !== undefined) {
      if (body[key] !== null && (typeof body[key] !== 'string' || body[key].length > (key === 'note' ? 500 : 30))) {
        throw vErr(`Field "${key}" is invalid.`);
      }
      data[key] = body[key];
    }
  }
  return data;
}

/** PUT /api/wellness/:date  (YYYY-MM-DD) – create or update that day. */
export const upsertDay = asyncHandler(async (req, res) => {
  const { date } = req.params;
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) throw vErr('Date must be in YYYY-MM-DD format.');
  const log = await wellnessLogService.upsertDay(req.user.id, date, parseBody(req.body || {}));
  res.status(200).json({ success: true, data: { log } });
});

/** GET /api/wellness?from=&to=&limit= */
export const getLogs = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  for (const v of [from, to]) if (v !== undefined && !DATE_RE.test(String(v))) throw vErr('from/to must be YYYY-MM-DD.');
  const limit = req.query.limit ? Math.max(1, Math.min(parseInt(req.query.limit, 10) || 60, 365)) : 60;
  const logs = await wellnessLogService.listLogs(req.user.id, { from, to, limit });
  res.status(200).json({ success: true, data: { logs, count: logs.length } });
});

/** GET /api/wellness/summary?days=7 */
export const getSummary = asyncHandler(async (req, res) => {
  const days = Math.max(1, Math.min(parseInt(req.query.days, 10) || 7, 90));
  const summary = await wellnessLogService.getSummary(req.user.id, days);
  res.status(200).json({ success: true, data: { summary } });
});

/** DELETE /api/wellness/:id */
export const deleteLog = asyncHandler(async (req, res) => {
  await wellnessLogService.deleteLog(req.user.id, req.params.id);
  res.status(200).json({ success: true, data: { deleted: true } });
});

export default { upsertDay, getLogs, getSummary, deleteLog };
