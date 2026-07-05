/**
 * services/moodLogService.js
 *
 * Business logic for the Mood Tracker: logging moods, listing history,
 * and computing a simple summary (mood frequency breakdown) for the
 * Wellness Dashboard. Ownership scoping lives here so controllers stay thin.
 */

import MoodLog from '../models/MoodLog.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

/**
 * Creates a new mood log entry for a user.
 *
 * @param {string} userId
 * @param {Object} data - { mood, intensity?, loggedDate?, note?, tags? }
 */
async function createLog(userId, data) {
  let loggedDate = new Date();
  if (data.loggedDate) {
    loggedDate = new Date(data.loggedDate);
    if (Number.isNaN(loggedDate.getTime())) {
      throw new AppError('Field "loggedDate" must be a valid date.', 400);
    }
  }

  const log = await MoodLog.create({
    user: userId,
    mood: data.mood,
    intensity: data.intensity ?? 3,
    loggedDate,
    note: data.note ?? null,
    tags: data.tags ?? [],
  });

  logger.info(`Mood log created for user ${userId}: ${log.mood}`);
  return log;
}

/**
 * Lists a user's mood logs, most recent first. Supports optional
 * date-range filtering for calendar/history views.
 *
 * @param {string} userId
 * @param {Object} [range] - { from?: Date, to?: Date }
 */
async function listLogs(userId, range = {}) {
  const query = { user: userId };

  if (range.from || range.to) {
    query.loggedDate = {};
    if (range.from) query.loggedDate.$gte = range.from;
    if (range.to) query.loggedDate.$lte = range.to;
  }

  return MoodLog.find(query).sort({ loggedDate: -1 });
}

/**
 * Fetches a single mood log, scoped to its owning user.
 */
async function getLog(userId, logId) {
  const log = await MoodLog.findOne({ _id: logId, user: userId });
  if (!log) {
    throw new AppError('Mood log not found.', 404);
  }
  return log;
}

/**
 * Updates an existing mood log, scoped to its owning user.
 */
async function updateLog(userId, logId, updates) {
  const log = await MoodLog.findOneAndUpdate({ _id: logId, user: userId }, updates, {
    new: true,
    runValidators: true,
  });

  if (!log) {
    throw new AppError('Mood log not found.', 404);
  }

  return log;
}

/**
 * Deletes a mood log, scoped to its owning user.
 */
async function deleteLog(userId, logId) {
  const result = await MoodLog.findOneAndDelete({ _id: logId, user: userId });
  if (!result) {
    throw new AppError('Mood log not found.', 404);
  }
  return result;
}

/**
 * Summarizes mood frequency over the last N days for the wellness
 * dashboard (e.g. "6 happy, 3 tired, 1 anxious in the last 30 days").
 */
async function getMoodSummary(userId, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const logs = await MoodLog.find({ user: userId, loggedDate: { $gte: since } });

  const counts = logs.reduce((acc, log) => {
    acc[log.mood] = (acc[log.mood] || 0) + 1;
    return acc;
  }, {});

  return {
    periodDays: days,
    totalEntries: logs.length,
    moodCounts: counts,
  };
}

export default { createLog, listLogs, getLog, updateLog, deleteLog, getMoodSummary };
