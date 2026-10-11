/**
 * services/wellnessLogService.js
 *
 * Daily wellness persistence (water, sleep, activity, stress) with
 * upsert-per-day semantics, history and weekly summary.
 */

import WellnessLog from '../models/WellnessLog.js';
import { AppError } from '../middleware/errorHandler.js';

const FIELDS = ['waterGlasses', 'sleepHours', 'sleepBucket', 'activityMinutes', 'stressLevel', 'mood', 'note'];

/** Insert or update the entry for `date`. */
async function upsertDay(userId, date, data) {
  const update = {};
  for (const key of FIELDS) if (data[key] !== undefined) update[key] = data[key];

  return WellnessLog.findOneAndUpdate(
    { user: userId, date },
    { $set: update, $setOnInsert: { user: userId, date } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
}

async function listLogs(userId, { from, to, limit = 60 } = {}) {
  const filter = { user: userId };
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = from;
    if (to) filter.date.$lte = to;
  }
  return WellnessLog.find(filter).sort({ date: -1 }).limit(Math.min(limit, 365));
}

async function getLog(userId, id) {
  const log = await WellnessLog.findOne({ _id: id, user: userId });
  if (!log) throw new AppError('Wellness entry not found.', 404);
  return log;
}

async function deleteLog(userId, id) {
  const result = await WellnessLog.findOneAndDelete({ _id: id, user: userId });
  if (!result) throw new AppError('Wellness entry not found.', 404);
  return result;
}

const avg = (values) => (values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null);

/** Pure summary over already-fetched entries (unit-testable). */
export function summarize(entries) {
  return {
    daysLogged: entries.length,
    averageWaterGlasses: avg(entries.map((e) => e.waterGlasses).filter((v) => typeof v === 'number')),
    averageSleepHours: avg(entries.map((e) => e.sleepHours).filter((v) => typeof v === 'number')),
    averageActivityMinutes: avg(entries.map((e) => e.activityMinutes).filter((v) => typeof v === 'number')),
    averageStressLevel: avg(entries.map((e) => e.stressLevel).filter((v) => typeof v === 'number')),
    daysWaterGoalMet: entries.filter((e) => e.waterGlasses >= 8).length,
  };
}

/** Summary of the last `days` calendar days (default 7). */
async function getSummary(userId, days = 7) {
  const since = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000);
  const from = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, '0')}-${String(since.getDate()).padStart(2, '0')}`;
  const entries = await WellnessLog.find({ user: userId, date: { $gte: from } }).sort({ date: 1 });
  return { periodDays: days, from, ...summarize(entries), entries };
}

export default { upsertDay, listLogs, getLog, deleteLog, getSummary };
