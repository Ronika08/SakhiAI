export const LS = {
  mood: "sakhi_mood",
  lmp: "sakhi_lmp",
  cycleLength: "sakhi_cycleLength",
  contacts: "sakhi_contacts",
  lastSosTs: "sakhi_lastSosTs",
  lastSosLoc: "sakhi_lastSosLoc",
  water: "sakhi_water",
  sleep: "sakhi_sleep",
  moodHistory: "sakhi_moodHistory",
  cycleHistory: "sakhi_cycleHistory",
  wellnessLog: "sakhi_wellnessLog",
  checkInTime: "sakhi_checkInTime",
  checkInActive: "sakhi_checkInActive",
};

export function lsGet(key, fallback) {
  try {
    const r = localStorage.getItem(key);
    return r !== null ? JSON.parse(r) : fallback;
  } catch {
    return fallback;
  }
}

export function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}