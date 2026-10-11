import { describe, it, expect, vi, beforeEach } from 'vitest'

const cycles = []
const moods = []
vi.mock('../models/CycleLog.js', () => ({
  default: {
    findOne: vi.fn(async (q) => cycles.find((c) => c.user === q.user && c.clientId === q.clientId) || null),
    create: vi.fn(async (d) => { const x = { _id: `c${cycles.length}`, ...d }; cycles.push(x); return x }),
    find: vi.fn(),
  },
}))
vi.mock('../models/MoodLog.js', () => ({
  default: {
    findOne: vi.fn(async (q) => moods.find((c) => c.user === q.user && c.clientId === q.clientId) || null),
    create: vi.fn(async (d) => { const x = { _id: `m${moods.length}`, ...d }; moods.push(x); return x }),
  },
}))

import cycleService from '../services/cycleLogService.js'
import moodService from '../services/moodLogService.js'

describe('offline replays are idempotent', () => {
  beforeEach(() => { cycles.length = 0; moods.length = 0 })

  it('replaying the same cycle clientId creates ONE record', async () => {
    const a = await cycleService.createLog('u1', { startDate: '2026-10-01', clientId: 'cyc-dev-2026-10-01' })
    const b = await cycleService.createLog('u1', { startDate: '2026-10-01', clientId: 'cyc-dev-2026-10-01' })
    expect(b).toBe(a)
    expect(cycles).toHaveLength(1)
  })
  it('the same clientId for a different user is a different record', async () => {
    await cycleService.createLog('u1', { startDate: '2026-10-01', clientId: 'same-client-id' })
    await cycleService.createLog('u2', { startDate: '2026-10-01', clientId: 'same-client-id' })
    expect(cycles).toHaveLength(2)
  })
  it('replaying the same mood clientId creates ONE record', async () => {
    await moodService.createLog('u1', { mood: 'happy', clientId: 'mood-dev-abc123' })
    await moodService.createLog('u1', { mood: 'happy', clientId: 'mood-dev-abc123' })
    expect(moods).toHaveLength(1)
  })
  it('requests without a clientId still create normally', async () => {
    await moodService.createLog('u1', { mood: 'happy' })
    await moodService.createLog('u1', { mood: 'happy' })
    expect(moods).toHaveLength(2)
  })
})
