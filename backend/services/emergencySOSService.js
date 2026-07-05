/**
 * services/emergencySOSService.js
 *
 * Business logic for the Emergency SOS ("panic button") feature: creating
 * an SOS event, resolving which Trusted Circle contacts to notify, and
 * (for now) recording a best-effort notification outcome. Actual SMS/
 * push delivery is a pending integration — this service is written so
 * swapping in a real notification provider later only touches the
 * `dispatchNotifications` function.
 */

import EmergencySOS from '../models/EmergencySOS.js';
import EmergencyContact from '../models/EmergencyContact.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

/**
 * Builds a shareable Google Maps link from raw coordinates.
 */
function buildLocationUrl(latitude, longitude) {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

/**
 * Placeholder notification dispatch. Currently just logs the intended
 * recipients — real SMS/push/email delivery is a pending integration.
 * Returns true on "success" so status can be marked `sent`, or false to
 * mark `failed`.
 *
 * @param {import('../models/EmergencyContact.js').default[]} contacts
 * @param {import('../models/EmergencySOS.js').default} sosEvent
 */
async function dispatchNotifications(contacts, sosEvent) {
  if (contacts.length === 0) return false;

  try {
    contacts.forEach((contact) => {
      logger.info(
        `[SOS] Would notify ${contact.name} (${contact.phone}) — event ${sosEvent._id}`
      );
    });
    // TODO: integrate real SMS/push provider here.
    return true;
  } catch (err) {
    logger.error(`SOS notification dispatch failed: ${err.message}`);
    return false;
  }
}

/**
 * Triggers a new SOS event for a user.
 *
 * @param {string} userId
 * @param {Object} data
 * @param {number} data.latitude
 * @param {number} data.longitude
 * @param {string} [data.message]
 * @param {string} [data.deviceInfo]
 * @param {number} [data.batteryLevel]
 */
async function triggerSOS(userId, data) {
  const { latitude, longitude, message, deviceInfo, batteryLevel } = data;

  const contacts = await EmergencyContact.find({
    user: userId,
    'notifyOn.sos': true,
  }).sort({ isPrimary: -1, createdAt: 1 });

  if (contacts.length === 0) {
    throw new AppError(
      'No trusted contacts are configured to notify. Add someone to your Trusted Circle first.',
      400
    );
  }

  const sosEvent = await EmergencySOS.create({
    user: userId,
    latitude,
    longitude,
    locationUrl: buildLocationUrl(latitude, longitude),
    message: message || null,
    deviceInfo: deviceInfo || null,
    batteryLevel: batteryLevel ?? null,
    contactsNotified: contacts.map((c) => c._id),
    status: 'pending',
  });

  logger.warn(`SOS triggered by user ${userId} at (${latitude}, ${longitude})`);

  const delivered = await dispatchNotifications(contacts, sosEvent);
  sosEvent.status = delivered ? 'sent' : 'failed';
  await sosEvent.save();

  return sosEvent;
}

/**
 * Lists a user's past SOS events, most recent first.
 */
async function listSOSEvents(userId) {
  return EmergencySOS.find({ user: userId }).sort({ triggeredAt: -1 });
}

/**
 * Fetches a single SOS event, scoped to its owning user.
 */
async function getSOSEvent(userId, sosId) {
  const sosEvent = await EmergencySOS.findOne({ _id: sosId, user: userId }).populate(
    'contactsNotified'
  );
  if (!sosEvent) {
    throw new AppError('SOS event not found.', 404);
  }
  return sosEvent;
}

export default { triggerSOS, listSOSEvents, getSOSEvent };
