/**
 * controllers/safetyCheckInController.js
 *
 * HTTP layer for the Safety Check-In feature. All routes here run behind
 * the `protect` auth middleware, so `req.user.id` is always available.
 * Validation of request bodies happens here; ownership rules and
 * persistence live in services/safetyCheckInService.js.
 */

import { AppError } from '../middleware/errorHandler.js';
import safetyCheckInService from '../services/safetyCheckInService.js';

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/**
 * Validates an optional { lat, lng, address } location object.
 */
function validateLocation(location, fieldName) {
  if (location === undefined || location === null) return undefined;

  if (typeof location !== 'object' || Array.isArray(location)) {
    throw new AppError(`Field "${fieldName}" must be an object.`, 400);
  }

  const { lat, lng, address } = location;

  if (lat !== undefined && lat !== null && typeof lat !== 'number') {
    throw new AppError(`Field "${fieldName}.lat" must be a number.`, 400);
  }
  if (lng !== undefined && lng !== null && typeof lng !== 'number') {
    throw new AppError(`Field "${fieldName}.lng" must be a number.`, 400);
  }
  if (address !== undefined && address !== null && typeof address !== 'string') {
    throw new AppError(`Field "${fieldName}.address" must be a string.`, 400);
  }

  return location;
}

/**
 * POST /api/checkins
 * Body: { label?, startLocation?, destination?, deadline, notifyContacts? }
 */
export const createCheckIn = asyncHandler(async (req, res) => {
  const { label, startLocation, destination, deadline, notifyContacts } = req.body;

  if (!deadline) {
    throw new AppError('Field "deadline" is required.', 400);
  }

  if (notifyContacts !== undefined && !Array.isArray(notifyContacts)) {
    throw new AppError('Field "notifyContacts" must be an array of contact ids.', 400);
  }

  const checkIn = await safetyCheckInService.startCheckIn(req.user.id, {
    label,
    startLocation: validateLocation(startLocation, 'startLocation'),
    destination: validateLocation(destination, 'destination'),
    deadline,
    notifyContacts,
  });

  res.status(201).json({ success: true, data: { checkIn } });
});

/**
 * GET /api/checkins
 */
export const getCheckIns = asyncHandler(async (req, res) => {
  const checkIns = await safetyCheckInService.listCheckIns(req.user.id);
  res.status(200).json({ success: true, data: { checkIns } });
});

/**
 * GET /api/checkins/:id
 */
export const getCheckIn = asyncHandler(async (req, res) => {
  const checkIn = await safetyCheckInService.getCheckIn(req.user.id, req.params.id);
  res.status(200).json({ success: true, data: { checkIn } });
});

/**
 * PATCH /api/checkins/:id/confirm
 */
export const confirmCheckIn = asyncHandler(async (req, res) => {
  const checkIn = await safetyCheckInService.confirmCheckIn(req.user.id, req.params.id);
  res.status(200).json({ success: true, data: { checkIn } });
});

/**
 * PATCH /api/checkins/:id/cancel
 */
export const cancelCheckIn = asyncHandler(async (req, res) => {
  const checkIn = await safetyCheckInService.cancelCheckIn(req.user.id, req.params.id);
  res.status(200).json({ success: true, data: { checkIn } });
});

export default { createCheckIn, getCheckIns, getCheckIn, confirmCheckIn, cancelCheckIn };
