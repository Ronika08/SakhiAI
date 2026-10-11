/**
 * controllers/emergencySOSController.js
 *
 * HTTP layer for SOS events. Validates input (including GPS data) and
 * delegates to services/emergencySOSService.js.
 *
 * Response of POST /api/sos (201, or 200 for an idempotent retry):
 *   { success, data: { sosEvent, delivery: { notificationStatus, notificationMessage } } }
 * `delivery` states plainly whether anyone was actually alerted.
 */

import { AppError } from '../middleware/errorHandler.js';
import emergencySOSService, { describeOutcome } from '../services/emergencySOSService.js';

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const bad = (msg) => new AppError(msg, 400, null, 'LOCATION_ERROR');

/**
 * POST /api/sos
 * Body: { latitude?, longitude?, accuracy?, locationTimestamp?, message?,
 *         deviceInfo?, batteryLevel?, clientEventId? }
 * latitude/longitude may both be omitted when GPS is unavailable — the SOS is
 * still recorded and sent without coordinates.
 */
export const createSOS = asyncHandler(async (req, res) => {
  const { latitude, longitude, accuracy, locationTimestamp, message, deviceInfo, batteryLevel, clientEventId, clientTriggeredAt } = req.body;

  const hasLat = latitude !== undefined && latitude !== null;
  const hasLng = longitude !== undefined && longitude !== null;

  if (hasLat !== hasLng) {
    throw bad('Provide both "latitude" and "longitude", or neither if location is unavailable.');
  }
  if (hasLat) {
    if (!isNum(latitude) || latitude < -90 || latitude > 90) {
      throw bad('Field "latitude" must be a number between -90 and 90.');
    }
    if (!isNum(longitude) || longitude < -180 || longitude > 180) {
      throw bad('Field "longitude" must be a number between -180 and 180.');
    }
    // (0,0) "Null Island" is the classic bogus GPS value.
    if (latitude === 0 && longitude === 0) {
      throw bad('Location (0, 0) is not a valid GPS position. Please retry getting your location.');
    }
  }
  if (accuracy !== undefined && accuracy !== null && (!isNum(accuracy) || accuracy < 0 || accuracy > 1e6)) {
    throw bad('Field "accuracy" must be a non-negative number of metres.');
  }
  if (locationTimestamp !== undefined && locationTimestamp !== null && (!isNum(locationTimestamp) || locationTimestamp <= 0)) {
    throw bad('Field "locationTimestamp" must be a millisecond timestamp.');
  }
  if (message !== undefined && message !== null && (typeof message !== 'string' || message.length > 500)) {
    throw new AppError('Field "message" must be a string of at most 500 characters.', 400);
  }
  if (deviceInfo !== undefined && deviceInfo !== null && (typeof deviceInfo !== 'string' || deviceInfo.length > 300)) {
    throw new AppError('Field "deviceInfo" must be a string of at most 300 characters.', 400);
  }
  if (batteryLevel !== undefined && batteryLevel !== null && (!isNum(batteryLevel) || batteryLevel < 0 || batteryLevel > 100)) {
    throw new AppError('Field "batteryLevel" must be a number between 0 and 100.', 400);
  }
  if (clientEventId !== undefined && clientEventId !== null && (typeof clientEventId !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(clientEventId))) {
    throw new AppError('Field "clientEventId" must be 8-64 letters, digits, "-" or "_".', 400);
  }

  if (clientTriggeredAt !== undefined && clientTriggeredAt !== null && !isNum(clientTriggeredAt)) {
    throw new AppError('Field "clientTriggeredAt" must be a millisecond timestamp.', 400);
  }

  const sosEvent = await emergencySOSService.triggerSOS(req.user.id, {
    latitude: hasLat ? latitude : undefined,
    longitude: hasLng ? longitude : undefined,
    accuracy: accuracy ?? undefined,
    locationTimestamp: locationTimestamp ?? undefined,
    message,
    deviceInfo,
    batteryLevel,
    clientEventId,
    clientTriggeredAt,
  });

  res.status(201).json({
    success: true,
    data: { sosEvent, delivery: describeOutcome(sosEvent) },
  });
});

export const getSOSEvents = asyncHandler(async (req, res) => {
  const sosEvents = await emergencySOSService.listSOSEvents(req.user.id);
  res.status(200).json({ success: true, data: { sosEvents } });
});

export const getSOSEvent = asyncHandler(async (req, res) => {
  const sosEvent = await emergencySOSService.getSOSEvent(req.user.id, req.params.id);
  res.status(200).json({ success: true, data: { sosEvent, delivery: describeOutcome(sosEvent) } });
});

/**
 * POST /api/sos/:id/resolve   Body: { notifySafe?: boolean }
 * POST /api/sos/:id/cancel
 */
export const resolveSOS = asyncHandler(async (req, res) => {
  const notifySafe = req.body?.notifySafe === true;
  const { sosEvent, safeNotice } = await emergencySOSService.closeSOS(req.user.id, req.params.id, {
    outcome: 'resolved',
    notifySafe,
  });
  res.status(200).json({ success: true, data: { sosEvent, safeNotice } });
});

export const cancelSOS = asyncHandler(async (req, res) => {
  const { sosEvent } = await emergencySOSService.closeSOS(req.user.id, req.params.id, { outcome: 'cancelled' });
  res.status(200).json({ success: true, data: { sosEvent } });
});

export default { createSOS, getSOSEvents, getSOSEvent, resolveSOS, cancelSOS };
