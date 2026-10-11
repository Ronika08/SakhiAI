/**
 * services/checkInMonitor.js
 *
 * Background job: finds safety check-ins whose deadline has passed without
 * confirmation, marks them `missed`, and alerts the user's chosen contacts
 * through the provider-independent notification service.
 *
 * It only runs while MongoDB is connected, never throws, and reports the
 * honest outcome in the logs. If no notification provider is configured the
 * check-in is still marked `missed` and the log states that nobody was
 * notified (NOT_CONFIGURED).
 */

import SafetyCheckIn from '../models/SafetyCheckIn.js';
import User from '../models/User.js';
import EmergencyContact from '../models/EmergencyContact.js';
import notificationService from './notificationService.js';
import { retryDueNotifications } from './emergencySOSService.js';
import { isDbConnected } from '../config/db.js';
import logger from '../utils/logger.js';

let timer = null;
let running = false;

export async function processOverdueCheckIns() {
  if (running || !isDbConnected()) return 0;
  running = true;
  let processed = 0;

  try {
    // Atomically claim each overdue check-in so concurrent instances never double-alert.
    for (;;) {
      const checkIn = await SafetyCheckIn.findOneAndUpdate(
        { status: 'pending', deadline: { $lt: new Date() } },
        { $set: { status: 'missed' } },
        { new: true }
      );
      if (!checkIn) break;
      processed += 1;

      const [user, contacts] = await Promise.all([
        User.findById(checkIn.user).select('name'),
        EmergencyContact.find({ _id: { $in: checkIn.notifyContacts } }),
      ]);

      const loc = checkIn.startLocation;
      const hasLoc = typeof loc?.lat === 'number' && typeof loc?.lng === 'number';
      const alert = notificationService.buildAlert({
        type: 'checkin_missed',
        userName: user?.name,
        latitude: hasLoc ? loc.lat : undefined,
        longitude: hasLoc ? loc.lng : undefined,
        locationUrl: hasLoc ? `https://www.google.com/maps?q=${loc.lat},${loc.lng}` : null,
        message: checkIn.label,
        eventId: checkIn._id,
      });

      const { summary } = await notificationService.dispatchAlert({
        userId: checkIn.user,
        contacts,
        alert,
      });
      logger.warn(`Check-in ${checkIn._id} missed; notification outcome=${summary.overall}`);
    }
    // SOS alerts whose first delivery attempt failed are retried here as well.
    processed += await retryDueNotifications();
  } catch (err) {
    logger.error(`Check-in monitor error: ${err.message}`);
  } finally {
    running = false;
  }
  return processed;
}

export function startCheckInMonitor(intervalMs = 60 * 1000) {
  if (timer) return;
  timer = setInterval(processOverdueCheckIns, intervalMs);
  timer.unref();
  logger.info('Check-in monitor started.');
}

export function stopCheckInMonitor() {
  if (timer) clearInterval(timer);
  timer = null;
}

export default { startCheckInMonitor, stopCheckInMonitor, processOverdueCheckIns };
