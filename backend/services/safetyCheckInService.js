/**
 * services/safetyCheckInService.js
 *
 * Business logic for the Safety Check-In feature: starting a check-in,
 * confirming safe arrival, cancelling, and listing a user's check-ins.
 * Ownership scoping (a user can only touch their own check-ins) lives
 * here so controllers stay thin.
 */

import SafetyCheckIn from '../models/SafetyCheckIn.js';
import EmergencyContact from '../models/EmergencyContact.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

/**
 * Starts a new safety check-in for a user.
 *
 * If `notifyContacts` ids aren't explicitly provided, defaults to every
 * contact currently in the user's Trusted Circle that has
 * `notifyOn.checkInMissed` enabled.
 *
 * @param {string} userId
 * @param {Object} data - { label?, startLocation?, destination?, deadline, notifyContacts? }
 */
async function startCheckIn(userId, data) {
  const deadline = new Date(data.deadline);
  if (Number.isNaN(deadline.getTime()) || deadline <= new Date()) {
    throw new AppError('Field "deadline" must be a valid date/time in the future.', 400);
  }

  let notifyContacts = data.notifyContacts;
  if (!notifyContacts || notifyContacts.length === 0) {
    const defaultContacts = await EmergencyContact.find({
      user: userId,
      'notifyOn.checkInMissed': true,
    }).select('_id');
    notifyContacts = defaultContacts.map((c) => c._id);
  }

  if (notifyContacts.length === 0) {
    throw new AppError(
      'No trusted contacts are configured to notify. Add someone to your Trusted Circle first.',
      400
    );
  }

  const checkIn = await SafetyCheckIn.create({
    user: userId,
    label: data.label,
    startLocation: data.startLocation,
    destination: data.destination,
    deadline,
    notifyContacts,
  });

  logger.info(`Safety check-in started for user ${userId}, deadline ${deadline.toISOString()}`);
  return checkIn;
}

/**
 * Lists a user's check-ins, most recent first.
 */
async function listCheckIns(userId) {
  return SafetyCheckIn.find({ user: userId }).sort({ createdAt: -1 });
}

/**
 * Fetches a single check-in, scoped to its owning user.
 */
async function getCheckIn(userId, checkInId) {
  const checkIn = await SafetyCheckIn.findOne({ _id: checkInId, user: userId });
  if (!checkIn) {
    throw new AppError('Safety check-in not found.', 404);
  }
  return checkIn;
}

/**
 * Confirms a pending check-in as safe.
 */
async function confirmCheckIn(userId, checkInId) {
  const checkIn = await getCheckIn(userId, checkInId);

  if (checkIn.status !== 'pending') {
    throw new AppError(`Cannot confirm a check-in with status "${checkIn.status}".`, 400);
  }

  await checkIn.confirm();
  logger.info(`Safety check-in confirmed for user ${userId}: ${checkInId}`);
  return checkIn;
}

/**
 * Cancels a pending check-in.
 */
async function cancelCheckIn(userId, checkInId) {
  const checkIn = await getCheckIn(userId, checkInId);

  if (checkIn.status !== 'pending') {
    throw new AppError(`Cannot cancel a check-in with status "${checkIn.status}".`, 400);
  }

  await checkIn.cancel();
  logger.info(`Safety check-in cancelled for user ${userId}: ${checkInId}`);
  return checkIn;
}

/**
 * Finds all pending check-ins whose deadline has already passed.
 * Intended to be called by a future scheduled job that marks them
 * "missed" and triggers Trusted Circle notifications.
 */
async function findOverdueCheckIns() {
  return SafetyCheckIn.find({ status: 'pending', deadline: { $lt: new Date() } }).populate(
    'notifyContacts'
  );
}

export default {
  startCheckIn,
  listCheckIns,
  getCheckIn,
  confirmCheckIn,
  cancelCheckIn,
  findOverdueCheckIns,
};
