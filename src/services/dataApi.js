/**
 * services/dataApi.js
 *
 * Backend persistence for Trusted Circle, Cycle, Mood, Wellness, Check-In,
 * SOS and notification settings. Includes the mapping between the existing
 * frontend (localStorage) data shapes and the backend models, so the current
 * UI keeps working unchanged.
 *
 * All functions are used only when the user is signed in; anonymous users
 * continue to use localStorage.
 */
import api from "./apiClient";

// ───────────────────────── Mood emoji ⇄ backend mood ─────────────────────────
const EMOJI_TO_MOOD = { "😊": "happy", "😌": "calm", "😔": "sad", "😤": "irritable", "😴": "tired" };
const MOOD_TO_EMOJI = Object.fromEntries(Object.entries(EMOJI_TO_MOOD).map(([e, m]) => [m, e]));
export const moodFromEmoji = (e) => EMOJI_TO_MOOD[e] || "neutral";
export const emojiFromMood = (m) => MOOD_TO_EMOJI[m] || "😌";

const dayKeyOf = (iso) => new Date(iso).toISOString().slice(0, 10);

// ───────────────────────── Contacts ─────────────────────────
export const contactsApi = {
  async list() {
    const { contacts } = await api("/api/contacts");
    return contacts;
  },
  toFrontend: (c) => ({
    id: c._id, name: c.name, phone: c.phone, email: c.email || "", relationship: c.relation || "Other",
    isPrimary: Boolean(c.isPrimary), notifySos: c.notifyOn?.sos !== false,
  }),
  toBackend: (c, index) => ({
    name: c.name.trim(), phone: c.phone.trim(), email: c.email?.trim() || null,
    relation: c.relationship || null, isPrimary: index === 0,
    notifyOn: { sos: c.notifySos !== false },
  }),
  /**
   * Replace-sync of the 3 UI slots with the server list:
   * filled slot with id → PATCH, filled without id → POST, emptied slot with id → DELETE.
   * Returns the new slot array (with ids) and per-slot errors.
   */
  async sync(slots) {
    const errors = [];
    const next = [...slots];
    for (let i = 0; i < slots.length; i += 1) {
      const slot = slots[i];
      const filled = slot.name?.trim() && slot.phone?.trim();
      try {
        if (filled && slot.id) {
          const { contact } = await api(`/api/contacts/${slot.id}`, { method: "PATCH", body: contactsApi.toBackend(slot, i) });
          next[i] = { ...contactsApi.toFrontend(contact), relationship: slot.relationship };
        } else if (filled) {
          const { contact } = await api("/api/contacts", { method: "POST", body: contactsApi.toBackend(slot, i) });
          next[i] = { ...contactsApi.toFrontend(contact), relationship: slot.relationship };
        } else if (slot.id) {
          await api(`/api/contacts/${slot.id}`, { method: "DELETE" });
          next[i] = { name: "", phone: "", email: "", relationship: slot.relationship };
        }
      } catch (err) {
        errors.push({ index: i, message: err.userMessage || err.message });
      }
    }
    return { slots: next, errors };
  },
};

// ───────────────────────── Cycle ─────────────────────────
export const cycleApi = {
  async list() {
    const { logs } = await api("/api/cycles");
    return logs || [];
  },
  toFrontend: (l) => ({
    id: l._id, date: dayKeyOf(l.startDate), cycleLength: l.cycleLengthDays || 28, phase: null,
    flow: l.flow || null, symptoms: l.symptoms || [], notes: l.notes || "",
    logged: new Date(l.createdAt || l.startDate).toLocaleDateString("en-IN"),
  }),
  async save({ date, cycleLength, flow, symptoms, notes, clientId }, existingId) {
    const body = {
      ...(clientId && !existingId ? { clientId } : {}),
      startDate: date, cycleLengthDays: cycleLength,
      ...(flow ? { flow } : {}), symptoms: symptoms || [], ...(notes ? { notes } : {}),
    };
    const { log } = existingId
      ? await api(`/api/cycles/${existingId}`, { method: "PATCH", body })
      : await api("/api/cycles", { method: "POST", body });
    return log;
  },
  remove: (id) => api(`/api/cycles/${id}`, { method: "DELETE" }),
  async predict() {
    const { prediction } = await api("/api/cycles/predict");
    return prediction;
  },
};

// ───────────────────────── Mood ─────────────────────────
export const moodApi = {
  async list() {
    const { logs } = await api("/api/moods?limit=30");
    return logs || [];
  },
  toFrontend: (l) => ({ emoji: emojiFromMood(l.mood), date: new Date(l.loggedDate).toLocaleString("en-IN"), dayKey: dayKeyOf(l.loggedDate), id: l._id }),
  save: (emoji) => api("/api/moods", { method: "POST", body: { mood: moodFromEmoji(emoji), loggedDate: new Date().toISOString() } }),
};

// ───────────────────────── Wellness ─────────────────────────
export const wellnessApi = {
  async list() {
    const { logs } = await api("/api/wellness?limit=60");
    return logs || [];
  },
  toFrontend: (l) => ({
    id: l._id, date: l.date, water: l.waterGlasses ?? 0, sleep: l.sleepBucket || "", mood: l.mood || "",
    activity: l.activityMinutes ?? "", stress: l.stressLevel ?? "",
  }),
  save: ({ date, water, sleep, mood, activity, stress }) =>
    api(`/api/wellness/${date}`, {
      method: "PUT",
      body: {
        waterGlasses: water,
        ...(sleep ? { sleepBucket: sleep } : {}),
        ...(mood ? { mood } : {}),
        ...(activity !== "" && activity != null ? { activityMinutes: Number(activity) } : {}),
        ...(stress !== "" && stress != null ? { stressLevel: Number(stress) } : {}),
      },
    }),
  async summary(days = 7) {
    const { summary } = await api(`/api/wellness/summary?days=${days}`);
    return summary;
  },
};

// ───────────────────────── Check-in ─────────────────────────
export const checkInApi = {
  start: ({ minutes, label, location }) =>
    api("/api/checkins", {
      method: "POST",
      body: {
        label: label || "Safety Check-In",
        deadline: new Date(Date.now() + minutes * 60000).toISOString(),
        ...(location ? { startLocation: { lat: location.lat, lng: location.lng } } : {}),
      },
    }),
  confirm: (id) => api(`/api/checkins/${id}/confirm`, { method: "PATCH" }),
  cancel: (id) => api(`/api/checkins/${id}/cancel`, { method: "PATCH" }),
};

// ───────────────────────── SOS & notifications ─────────────────────────
const newEventId = () =>
  (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, "");

export const sosApi = {
  newEventId,
  /** Backend SOS. Location is optional — a missing GPS fix never blocks the alert. */
  trigger: ({ location, clientEventId }) =>
    api("/api/sos", {
      method: "POST",
      body: {
        ...(location ? { latitude: location.lat, longitude: location.lng, accuracy: location.accuracy ?? undefined, locationTimestamp: location.timestamp ?? Date.now() } : {}),
        deviceInfo: (navigator.userAgent || "").slice(0, 300),
        clientEventId,
      },
    }),
  resolve: (id, notifySafe) => api(`/api/sos/${id}/resolve`, { method: "POST", body: { notifySafe: Boolean(notifySafe) } }),
  cancel: (id) => api(`/api/sos/${id}/cancel`, { method: "POST", body: {} }),
};

export const notificationsApi = {
  status: () => api("/api/notifications/status", { auth: false }),
  sendTest: () => api("/api/notifications/test", { method: "POST", body: {} }),
  subscribePush: (subscription) => api("/api/notifications/push/subscribe", { method: "POST", body: { subscription } }),
  unsubscribePush: (endpoint) => api("/api/notifications/push/subscribe", { method: "DELETE", body: { endpoint } }),
};

// ───────────────────────── Safe Route (server-side Google Maps key) ─────────────────────────
export const routeApi = {
  /** origin/destination: { lat, lng } or { address }. Requires sign-in + internet + server Maps key. */
  async plan({ origin, destination, mode = "walking" }) {
    const { route } = await api("/api/routes/plan", { method: "POST", body: { origin, destination, mode } });
    return route;
  },
};
