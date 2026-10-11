/**
 * services/cycleLogService.js
 *
 * Business logic for the Period Cycle Tracker: logging cycles, listing
 * history, and predicting the next expected period based on the user's
 * recent cycle length average. Ownership scoping (a user can only touch
 * their own logs) lives here so controllers stay thin.
 */

import CycleLog from '../models/CycleLog.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

const DEFAULT_CYCLE_LENGTH_DAYS = 28;
const PREDICTION_LOOKBACK = 6; // average over the last N cycles

/**
 * Creates a new cycle log entry for a user.
 *
 * @param {string} userId
 * @param {Object} data - { startDate, endDate?, cycleLengthDays?, flow?, symptoms?, mood?, notes? }
 */
async function createLog(userId, data) {
  // Idempotent replay from the offline outbox.
  if (data.clientId) {
    const existing = await CycleLog.findOne({ user: userId, clientId: data.clientId });
    if (existing) return existing;
  }
  const startDate = new Date(data.startDate);
  if (Number.isNaN(startDate.getTime())) {
    throw new AppError('Field "startDate" must be a valid date.', 400);
  }

  let endDate = null;
  if (data.endDate) {
    endDate = new Date(data.endDate);
    if (Number.isNaN(endDate.getTime())) {
      throw new AppError('Field "endDate" must be a valid date.', 400);
    }
    if (endDate < startDate) {
      throw new AppError('Field "endDate" cannot be before "startDate".', 400);
    }
  }

  const log = await CycleLog.create({
    user: userId,
    startDate,
    endDate,
    cycleLengthDays: data.cycleLengthDays ?? null,
    flow: data.flow ?? null,
    symptoms: data.symptoms ?? [],
    mood: data.mood ?? null,
    notes: data.notes ?? null,
    clientId: data.clientId || undefined,
  });

  logger.info(`Cycle log created for user ${userId}, startDate ${startDate.toISOString()}`);
  return log;
}

/**
 * Lists a user's cycle logs, most recent first.
 */
async function listLogs(userId) {
  return CycleLog.find({ user: userId }).sort({ startDate: -1 });
}

/**
 * Fetches a single cycle log, scoped to its owning user.
 */
async function getLog(userId, logId) {
  const log = await CycleLog.findOne({ _id: logId, user: userId });
  if (!log) {
    throw new AppError('Cycle log not found.', 404);
  }
  return log;
}

/**
 * Updates an existing cycle log, scoped to its owning user.
 */
async function updateLog(userId, logId, updates) {
  const log = await CycleLog.findOneAndUpdate({ _id: logId, user: userId }, updates, {
    new: true,
    runValidators: true,
  });

  if (!log) {
    throw new AppError('Cycle log not found.', 404);
  }

  return log;
}

/**
 * Deletes a cycle log, scoped to its owning user.
 */
async function deleteLog(userId, logId) {
  const result = await CycleLog.findOneAndDelete({ _id: logId, user: userId });
  if (!result) {
    throw new AppError('Cycle log not found.', 404);
  }
  return result;
}

/**
 * Predicts the next expected period start date and average cycle length,
 * based on the gaps between the user's most recent logged start dates.
 * Falls back to a 28-day default if there isn't enough history yet.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (date, days) => new Date(new Date(date).getTime() + days * DAY_MS);

export const CYCLE_DISCLAIMER =
  'These dates are statistical estimates from your own logged cycles, not medical advice and not contraception guidance. Cycles vary; talk to a healthcare professional about irregular or concerning patterns.';

/**
 * Pure prediction function (unit-testable, no DB).
 *
 * @param {Array<Date|string>} startDates - cycle start dates, any order
 * @returns {Object} prediction. Original fields are preserved
 *   (averageCycleLengthDays, nextPredictedStart, basedOnCycles) and extended
 *   with ovulation / fertile-window estimates, an irregularity flag and a
 *   disclaimer.
 */
export function computeCyclePrediction(startDates) {
  const starts = startDates
    .map((d) => new Date(d))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => b - a)
    .slice(0, PREDICTION_LOOKBACK + 1);

  if (starts.length === 0) {
    return {
      averageCycleLengthDays: null,
      nextPredictedStart: null,
      basedOnCycles: 0,
      ovulationEstimate: null,
      fertileWindow: null,
      irregular: false,
      variabilityDays: null,
      confidence: 'none',
      disclaimer: CYCLE_DISCLAIMER,
    };
  }

  const gaps = [];
  for (let i = 0; i < starts.length - 1; i += 1) {
    const diffDays = Math.round((starts[i] - starts[i + 1]) / DAY_MS);
    if (diffDays > 0 && diffDays <= 120) gaps.push(diffDays);
  }

  const usedDefault = gaps.length === 0;
  const average = usedDefault
    ? DEFAULT_CYCLE_LENGTH_DAYS
    : Math.round(gaps.reduce((sum, d) => sum + d, 0) / gaps.length);

  const variability = gaps.length >= 2 ? Math.max(...gaps) - Math.min(...gaps) : null;
  const outOfRange = gaps.some((g) => g < 21 || g > 35);
  const irregular = gaps.length >= 3 && (variability > 7 || outOfRange);

  const next = addDays(starts[0], average);
  const ovulation = addDays(next, -14);

  // Irregular or sparse data → widen the window and say so.
  const confidence = usedDefault ? 'low' : irregular ? 'low' : gaps.length >= 3 ? 'moderate' : 'low';
  const margin = irregular ? Math.max(variability || 7, 7) : 2;

  return {
    averageCycleLengthDays: average,
    nextPredictedStart: next,
    basedOnCycles: usedDefault ? 1 : gaps.length,
    nextPeriodRange: { earliest: addDays(next, -margin), latest: addDays(next, margin) },
    ovulationEstimate: ovulation,
    fertileWindow: { start: addDays(ovulation, -5), end: addDays(ovulation, 1) },
    irregular,
    variabilityDays: variability,
    confidence,
    usedDefaultLength: usedDefault,
    disclaimer: CYCLE_DISCLAIMER,
    note: irregular
      ? 'Your cycle lengths vary a lot, so these estimates are unreliable. Consider discussing your cycle with a healthcare professional.'
      : usedDefault
        ? 'Based on a typical 28-day cycle because only one period has been logged.'
        : null,
  };
}

async function predictNextCycle(userId) {
  const logs = await CycleLog.find({ user: userId })
    .sort({ startDate: -1 })
    .limit(PREDICTION_LOOKBACK + 1);

  return computeCyclePrediction(logs.map((l) => l.startDate));
}

export default { createLog, listLogs, getLog, updateLog, deleteLog, predictNextCycle };
