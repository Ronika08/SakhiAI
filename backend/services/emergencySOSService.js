/**
 * services/emergencySOSService.js
 *
 * Business logic for SOS emergency events.
 *
 * Flow: create event → notify through the provider-independent
 * notificationService → persist the HONEST per-attempt outcome.
 *
 * Notification dispatch itself lives in services/notificationService.js, so
 * adding or changing channels (Web Push, e-mail, webhook, future providers)
 * never touches this file.
 *
 * Honesty rule: `contactsNotified` only lists contacts for whom a provider
 * ACCEPTED an alert, and the status is `not_configured` / `failed` /
 * `pending` otherwise. Nothing here claims a person was reached.
 */

import EmergencySOS from '../models/EmergencySOS.js';
import EmergencyContact from '../models/EmergencyContact.js';
import User from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';
import notificationService, { NOTIFICATION_STATUS } from './notificationService.js';

function buildLocationUrl(latitude, longitude) {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

export function classifyAccuracy(accuracy) {
  if (typeof accuracy !== 'number' || !Number.isFinite(accuracy)) return 'unknown';
  if (accuracy <= 100) return 'good';
  if (accuracy <= 1000) return 'low';
  return 'poor';
}

export const MAX_NOTIFICATION_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = [30 * 1000, 2 * 60 * 1000, 5 * 60 * 1000];
const MAX_CLIENT_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Accepts the device's trigger time (SOS created while offline) only when it is
 * plausible: not in the future (2 min clock skew allowed) and at most 7 days old.
 */
export function parseClientTime(value, now = Date.now()) {
  if (value === undefined || value === null) return null;
  const ms = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  if (ms > now + 2 * 60 * 1000 || ms < now - MAX_CLIENT_AGE_MS) return null;
  return new Date(ms);
}

const STATUS_BY_OVERALL = {
  [NOTIFICATION_STATUS.SENT]: 'sent',
  [NOTIFICATION_STATUS.FAILED]: 'failed',
  [NOTIFICATION_STATUS.NO_RECIPIENT]: 'failed',
  [NOTIFICATION_STATUS.NO_CONTACTS]: 'failed',
  [NOTIFICATION_STATUS.NOT_CONFIGURED]: 'not_configured',
};


/**
 * Merges a dispatch outcome into an SOS document and decides the honest
 * status. Transient failures are marked RETRYING with a backoff; once the
 * attempts are exhausted the status becomes FAILED. Providers that already
 * accepted an alert are never re-sent.
 */
export function applyDispatch(sosEvent, dispatch, { replace = false } = {}) {
  const mapped = dispatch.results.map((r) => ({
    provider: r.provider,
    channel: r.channel,
    contact: r.contactId || null,
    contactName: r.contactName,
    status: r.status,
    detail: r.detail,
    at: r.at,
  }));
  sosEvent.notifications = replace ? mapped : [...(sosEvent.notifications || []), ...mapped];
  sosEvent.notificationAttempts = (sosEvent.notificationAttempts || 0) + 1;

  const all = sosEvent.notifications;
  const anySent = all.some((r) => r.status === NOTIFICATION_STATUS.SENT);
  let overall = dispatch.summary.overall;
  if (anySent) overall = NOTIFICATION_STATUS.SENT;

  if (overall === NOTIFICATION_STATUS.FAILED && sosEvent.notificationAttempts < MAX_NOTIFICATION_ATTEMPTS) {
    sosEvent.notificationStatus = 'RETRYING';
    sosEvent.status = 'pending';
    sosEvent.nextRetryAt = new Date(Date.now() + RETRY_BACKOFF_MS[Math.min(sosEvent.notificationAttempts - 1, RETRY_BACKOFF_MS.length - 1)]);
  } else {
    sosEvent.notificationStatus = overall;
    sosEvent.status = STATUS_BY_OVERALL[overall] || 'failed';
    sosEvent.nextRetryAt = null;
  }

  sosEvent.contactsNotified = [
    ...new Set(all.filter((r) => r.status === NOTIFICATION_STATUS.SENT && r.contact).map((r) => String(r.contact))),
  ];
  return sosEvent;
}

/** Keys (`provider:contactId|-`) of attempts a provider already accepted. */
function acceptedKeys(sosEvent) {
  return new Set(
    (sosEvent.notifications || [])
      .filter((r) => r.status === NOTIFICATION_STATUS.SENT)
      .map((r) => `${r.provider}:${r.contact ? String(r.contact) : '-'}`)
  );
}

/**
 * Re-attempts SOS notifications that failed transiently. Called by the
 * background monitor. Each event is claimed atomically before sending.
 */
export async function retryDueNotifications(now = new Date()) {
  let processed = 0;
  for (;;) {
    const sosEvent = await EmergencySOS.findOneAndUpdate(
      { notificationStatus: 'RETRYING', nextRetryAt: { $lte: now }, status: 'pending' },
      { $set: { nextRetryAt: new Date(now.getTime() + 60 * 1000) } },
      { new: true }
    );
    if (!sosEvent) break;
    processed += 1;

    try {
      const [user, contacts] = await Promise.all([
        User.findById(sosEvent.user).select('name'),
        EmergencyContact.find({ user: sosEvent.user, 'notifyOn.sos': true }),
      ]);
      const delayedMinutes = (Date.now() - new Date(sosEvent.triggeredAt).getTime()) / 60000;
      const alert = notificationService.buildAlert({
        type: 'sos',
        userName: user?.name,
        latitude: sosEvent.latitude,
        longitude: sosEvent.longitude,
        accuracy: sosEvent.accuracyMeters,
        locationUrl: sosEvent.locationUrl,
        message: sosEvent.message,
        eventId: sosEvent._id,
        triggeredAt: sosEvent.triggeredAt,
        delayedMinutes,
      });
      const dispatch = await notificationService.dispatchAlert({
        userId: sosEvent.user,
        contacts,
        alert,
        skip: acceptedKeys(sosEvent),
      });
      applyDispatch(sosEvent, dispatch);
      logger.warn(`SOS ${sosEvent._id} retry ${sosEvent.notificationAttempts}: ${sosEvent.notificationStatus}`);
    } catch (err) {
      logger.error(`SOS retry crashed for ${sosEvent._id}: ${err.message}`);
      sosEvent.notificationAttempts = (sosEvent.notificationAttempts || 0) + 1;
      sosEvent.notificationStatus = sosEvent.notificationAttempts >= MAX_NOTIFICATION_ATTEMPTS ? 'FAILED' : 'RETRYING';
      sosEvent.status = sosEvent.notificationStatus === 'FAILED' ? 'failed' : 'pending';
      sosEvent.nextRetryAt = sosEvent.notificationStatus === 'FAILED' ? null : new Date(Date.now() + 2 * 60 * 1000);
    }
    await sosEvent.save();
  }
  return processed;
}

/** Public shape returned to clients — states clearly what did / did not happen. */
export function describeOutcome(sosEvent) {
  const status = sosEvent.notificationStatus;
  const messages = {
    SENT: 'Alert handed to the configured notification service(s). Delivery to your contacts cannot be guaranteed — also call or message them directly.',
    FAILED: 'We could not send the alert through any configured channel. Please call or message your contacts directly, or call 112.',
    NO_RECIPIENT: 'No contact could be reached through the configured channels (missing e-mail or push subscription). Please call or message them directly, or call 112.',
    NO_CONTACTS: 'You have no trusted contacts saved, so no one was alerted. Add contacts in Trusted Circle, or call 112.',
    NOT_CONFIGURED: 'Automatic alerts are not set up on this server, so NO contact was notified. Please use the SMS/WhatsApp buttons or call 112.',
    PENDING: 'Alert is being processed.',
    RETRYING: 'The first attempt to send your alert failed. SakhiAI is retrying automatically — in the meantime please call or message your contacts directly, or call 112.',
  };
  return { notificationStatus: status, notificationMessage: messages[status] || messages.FAILED };
}

/**
 * Triggers a new SOS event for a user.
 *
 * @param {string} userId
 * @param {Object} data
 * @param {number} [data.latitude]
 * @param {number} [data.longitude]
 * @param {number} [data.accuracy]      - metres
 * @param {number} [data.locationTimestamp] - ms epoch of the GPS fix
 * @param {string} [data.message]
 * @param {string} [data.deviceInfo]
 * @param {number} [data.batteryLevel]
 * @param {string} [data.clientEventId] - idempotency key
 */
async function triggerSOS(userId, data) {
  const { latitude, longitude, accuracy, locationTimestamp, message, deviceInfo, batteryLevel, clientEventId } = data;
  const clientTime = parseClientTime(data.clientTriggeredAt);
  const delayedMinutes = clientTime ? (Date.now() - clientTime.getTime()) / 60000 : 0;

  // Idempotent retry: same clientEventId returns the existing event.
  if (clientEventId) {
    const existing = await EmergencySOS.findOne({ user: userId, clientEventId });
    if (existing) {
      logger.info(`SOS retry matched existing event ${existing._id} (idempotent).`);
      return existing;
    }
  }

  const hasLocation = typeof latitude === 'number' && typeof longitude === 'number';

  const contacts = await EmergencyContact.find({
    user: userId,
    'notifyOn.sos': true,
  }).sort({ isPrimary: -1, createdAt: 1 });

  let sosEvent;
  try {
    sosEvent = await EmergencySOS.create({
      user: userId,
      locationAvailable: hasLocation,
      latitude: hasLocation ? latitude : undefined,
      longitude: hasLocation ? longitude : undefined,
      accuracyMeters: typeof accuracy === 'number' ? accuracy : null,
      locationQuality: hasLocation ? classifyAccuracy(accuracy) : 'unknown',
      locationCapturedAt: locationTimestamp ? new Date(locationTimestamp) : null,
      locationUrl: hasLocation ? buildLocationUrl(latitude, longitude) : null,
      message: message || null,
      deviceInfo: deviceInfo || null,
      batteryLevel: batteryLevel ?? null,
      clientEventId: clientEventId || undefined,
      ...(clientTime && { triggeredAt: clientTime, clientTriggeredAt: clientTime }),
      syncedLate: delayedMinutes >= 2,
      status: 'pending',
      notificationStatus: NOTIFICATION_STATUS.PENDING,
    });
  } catch (err) {
    // Lost a race with a concurrent retry carrying the same clientEventId.
    if (err?.code === 11000 && clientEventId) {
      const existing = await EmergencySOS.findOne({ user: userId, clientEventId });
      if (existing) return existing;
    }
    throw err;
  }

  logger.warn(`SOS triggered event=${sosEvent._id} location=${hasLocation ? sosEvent.locationQuality : 'unavailable'}`);

  const user = await User.findById(userId).select('name');
  const alert = notificationService.buildAlert({
    type: 'sos',
    userName: user?.name,
    latitude: sosEvent.latitude,
    longitude: sosEvent.longitude,
    accuracy: sosEvent.accuracyMeters,
    locationUrl: sosEvent.locationUrl,
    message: sosEvent.message,
    eventId: sosEvent._id,
    triggeredAt: sosEvent.triggeredAt,
    delayedMinutes,
  });

  let dispatch;
  try {
    dispatch = await notificationService.dispatchAlert({ userId, contacts, alert });
  } catch (err) {
    logger.error(`SOS dispatch crashed for event ${sosEvent._id}: ${err.message}`);
    dispatch = {
      results: [{ status: NOTIFICATION_STATUS.FAILED, detail: 'Notification system error.', at: new Date() }],
      summary: { overall: NOTIFICATION_STATUS.FAILED },
    };
  }

  applyDispatch(sosEvent, dispatch, { replace: true });
  await sosEvent.save();

  return sosEvent;
}

async function listSOSEvents(userId) {
  return EmergencySOS.find({ user: userId }).sort({ triggeredAt: -1 }).limit(100);
}

async function getSOSEvent(userId, sosId) {
  const sosEvent = await EmergencySOS.findOne({ _id: sosId, user: userId }).populate('contactsNotified');
  if (!sosEvent) {
    throw new AppError('SOS event not found.', 404);
  }
  return sosEvent;
}

/**
 * Marks an SOS as resolved ("I'm safe") or cancelled. Optionally tells
 * contacts (through the same provider abstraction) that the user is safe.
 */
async function closeSOS(userId, sosId, { outcome, notifySafe = false }) {
  const sosEvent = await EmergencySOS.findOne({ _id: sosId, user: userId });
  if (!sosEvent) throw new AppError('SOS event not found.', 404);
  if (['resolved', 'cancelled'].includes(sosEvent.status)) return { sosEvent, safeNotice: null };

  if (outcome === 'cancelled') {
    sosEvent.status = 'cancelled';
    sosEvent.cancelledAt = new Date();
  } else {
    sosEvent.status = 'resolved';
    sosEvent.resolvedAt = new Date();
  }

  let safeNotice = null;
  if (notifySafe && outcome !== 'cancelled') {
    const contacts = await EmergencyContact.find({ user: userId, 'notifyOn.sos': true });
    const user = await User.findById(userId).select('name');
    const alert = notificationService.buildAlert({
      type: 'sos_resolved',
      userName: user?.name,
      eventId: sosEvent._id,
    });
    const dispatch = await notificationService.dispatchAlert({ userId, contacts, alert });
    safeNotice = dispatch.summary;
  }

  await sosEvent.save();
  return { sosEvent, safeNotice };
}

export default { triggerSOS, listSOSEvents, getSOSEvent, closeSOS, retryDueNotifications };
