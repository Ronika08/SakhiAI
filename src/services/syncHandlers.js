/**
 * services/syncHandlers.js
 *
 * Registers the outbox handlers that push locally-created data to the API
 * (and from there to MongoDB). Every handler is idempotent:
 *   mood.save      clientId (server de-duplicates)
 *   cycle.save     clientId (create) / PATCH by id (update)
 *   cycle.delete   404 counts as already deleted
 *   wellness.save  PUT per calendar day (natural upsert)
 *   contacts.sync  replace-sync keyed by phone number
 *   checkin.*      server ids; start is refused if the deadline already passed
 *   sos.create     clientEventId + clientTriggeredAt (server de-duplicates)
 */
import api, { ApiError } from './apiClient'
import { registerHandlers } from './syncQueue'
import { contactsApi, cycleApi, wellnessApi, checkInApi, moodFromEmoji } from './dataApi'

const readLocal = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v) } catch { return fallback }
}

const permanent = (message, code = 'VALIDATION_ERROR') => Object.assign(new ApiError({ message, code, status: 400 }), { permanent: true })

export function registerSyncHandlers() {
  registerHandlers({
    'mood.save': async ({ emoji, clientId, loggedDate }) =>
      api('/api/moods', { method: 'POST', body: { mood: moodFromEmoji(emoji), loggedDate, clientId } }),

    'wellness.save': async (p) => wellnessApi.save(p),

    'cycle.save': async ({ id, clientId, date, cycleLength, flow, symptoms, notes }) => {
      const log = await cycleApi.save({ date, cycleLength, flow, symptoms, notes, clientId }, id)
      return { log }
    },

    'cycle.delete': async ({ id }) => {
      try { await cycleApi.remove(id) } catch (err) { if (!(err instanceof ApiError && err.status === 404)) throw err }
      return { deleted: true }
    },

    'contacts.sync': async () => {
      const slots = readLocal('sakhi_contacts', [])
      const out = await contactsApi.sync(slots)
      // A conflict ("already in your circle") is not a reason to retry forever.
      const hard = out.errors.find((e) => !/already/i.test(e.message))
      if (hard) throw Object.assign(new ApiError({ message: hard.message, code: 'VALIDATION_ERROR', status: 400 }), { permanent: true })
      return out
    },

    'checkin.start': async ({ deadline, label, location, localId }) => {
      const ms = new Date(deadline).getTime() - Date.now()
      if (ms <= 0) throw permanent('The check-in time passed while the phone was offline, so the server could not alert your contacts.', 'CHECKIN_EXPIRED')
      const { checkIn } = await api('/api/checkins', {
        method: 'POST',
        body: { label: label || 'Safety Check-In', deadline, ...(location ? { startLocation: { lat: location.lat, lng: location.lng } } : {}) },
      })
      return { checkIn, localId }
    },
    'checkin.confirm': async ({ id }) => checkInApi.confirm(id).catch((e) => { if (!(e instanceof ApiError && e.status === 400)) throw e }),
    'checkin.cancel': async ({ id }) => checkInApi.cancel(id).catch((e) => { if (!(e instanceof ApiError && e.status === 400)) throw e }),

    'sos.create': async ({ location, clientEventId, clientTriggeredAt }) => {
      const body = (loc) => ({
        ...(loc ? { latitude: loc.lat, longitude: loc.lng, accuracy: loc.accuracy ?? undefined, locationTimestamp: loc.timestamp ?? undefined } : {}),
        deviceInfo: (navigator.userAgent || '').slice(0, 300),
        clientEventId,
        clientTriggeredAt,
      })
      try {
        return await api('/api/sos', { method: 'POST', body: body(location) })
      } catch (err) {
        // A bad location must never stop an SOS: retry once without coordinates.
        if (err instanceof ApiError && err.code === 'LOCATION_ERROR' && location) {
          return api('/api/sos', { method: 'POST', body: body(null) })
        }
        throw err
      }
    },
  })
}
