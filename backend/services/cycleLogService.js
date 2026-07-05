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
async function predictNextCycle(userId) {
  const logs = await CycleLog.find({ user: userId })
    .sort({ startDate: -1 })
    .limit(PREDICTION_LOOKBACK + 1);

  if (logs.length === 0) {
    return { averageCycleLengthDays: null, nextPredictedStart: null, basedOnCycles: 0 };
  }

  const mostRecentStart = logs[0].startDate;

  if (logs.length < 2) {
    const predicted = new Date(mostRecentStart);
    predicted.setDate(predicted.getDate() + DEFAULT_CYCLE_LENGTH_DAYS);
    return {
      averageCycleLengthDays: DEFAULT_CYCLE_LENGTH_DAYS,
      nextPredictedStart: predicted,
      basedOnCycles: 1,
    };
  }

  const gaps = [];
  for (let i = 0; i < logs.length - 1; i += 1) {
    const diffMs = logs[i].startDate.getTime() - logs[i + 1].startDate.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays > 0) gaps.push(diffDays);
  }

  const averageCycleLengthDays = gaps.length
    ? Math.round(gaps.reduce((sum, d) => sum + d, 0) / gaps.length)
    : DEFAULT_CYCLE_LENGTH_DAYS;

  const nextPredictedStart = new Date(mostRecentStart);
  nextPredictedStart.setDate(nextPredictedStart.getDate() + averageCycleLengthDays);

  return { averageCycleLengthDays, nextPredictedStart, basedOnCycles: gaps.length };
}

export default { createLog, listLogs, getLog, updateLog, deleteLog, predictNextCycle };
