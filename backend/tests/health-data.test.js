import { describe, it, expect } from 'vitest';
import { computeCyclePrediction, CYCLE_DISCLAIMER } from '../services/cycleLogService.js';
import { summarize } from '../services/wellnessLogService.js';
import { AppError } from '../middleware/errorHandler.js';

const d = (s) => new Date(s);

describe('cycle prediction', () => {
  it('no data -> nulls with disclaimer', () => {
    const p = computeCyclePrediction([]);
    expect(p.nextPredictedStart).toBeNull();
    expect(p.disclaimer).toBe(CYCLE_DISCLAIMER);
  });
  it('one period -> default 28 days, low confidence', () => {
    const p = computeCyclePrediction([d('2026-01-01')]);
    expect(p.averageCycleLengthDays).toBe(28);
    expect(p.confidence).toBe('low');
    expect(p.nextPredictedStart.toISOString().slice(0, 10)).toBe('2026-01-29');
  });
  it('regular cycles -> average, ovulation 14 days before next period, fertile window', () => {
    const p = computeCyclePrediction([d('2026-01-01'), d('2026-01-29'), d('2026-02-26'), d('2026-03-26')]);
    expect(p.averageCycleLengthDays).toBe(28);
    expect(p.irregular).toBe(false);
    expect(p.confidence).toBe('moderate');
    const next = p.nextPredictedStart.getTime();
    expect(next - p.ovulationEstimate.getTime()).toBe(14 * 86400000);
    expect(p.fertileWindow.end - p.fertileWindow.start).toBe(6 * 86400000);
  });
  it('irregular cycles are flagged, low confidence, wider range', () => {
    const p = computeCyclePrediction([d('2026-01-01'), d('2026-01-25'), d('2026-03-10'), d('2026-04-02'), d('2026-06-05')]);
    expect(p.irregular).toBe(true);
    expect(p.confidence).toBe('low');
    expect(p.note).toMatch(/healthcare professional/);
  });
});

describe('wellness summary', () => {
  it('averages only provided values', () => {
    const s = summarize([{ waterGlasses: 8, sleepHours: 7 }, { waterGlasses: 4, stressLevel: 3 }]);
    expect(s).toMatchObject({ daysLogged: 2, averageWaterGlasses: 6, averageSleepHours: 7, averageStressLevel: 3, daysWaterGoalMet: 1 });
    expect(summarize([]).averageWaterGlasses).toBeNull();
  });
});

describe('AppError', () => {
  it('derives a category from the status', () => {
    expect(new AppError('x', 401).code).toBe('AUTHENTICATION_ERROR');
    expect(new AppError('x', 403).code).toBe('AUTHORIZATION_ERROR');
    expect(new AppError('x', 429).code).toBe('RATE_LIMITED');
    expect(new AppError('x', 400, null, 'LOCATION_ERROR').code).toBe('LOCATION_ERROR');
  });
});
