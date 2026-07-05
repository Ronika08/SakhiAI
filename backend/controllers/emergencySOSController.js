/**
 * controllers/emergencySOSController.js
 *
 * HTTP layer for the Emergency SOS ("panic button") feature. All routes
 * here run behind the `protect` auth middleware, so `req.user.id` is
 * always available. Validation of request bodies happens here; ownership
 * rules and persistence live in services/emergencySOSService.js.
 */

import { AppError } from '../middleware/errorHandler.js';
import emergencySOSService from '../services/emergencySOSService.js';

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/**
 * POST /api/sos
 * Body: { latitude, longitude, message?, deviceInfo?, batteryLevel? }
 */
export const createSOS = asyncHandler(async (req, res) => {
  const { latitude, longitude, message, deviceInfo, batteryLevel } = req.body;

  if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
    throw new AppError('Field "latitude" must be a number between -90 and 90.', 400);
  }
  if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
    throw new AppError('Field "longitude" must be a number between -180 and 180.', 400);
  }
  if (message !== undefined && message !== null && typeof message !== 'string') {
    throw new AppError('Field "message" must be a string.', 400);
  }
  if (deviceInfo !== undefined && deviceInfo !== null && typeof deviceInfo !== 'string') {
    throw new AppError('Field "deviceInfo" must be a string.', 400);
  }
  if (
    batteryLevel !== undefined &&
    batteryLevel !== null &&
    (typeof batteryLevel !== 'number' || batteryLevel < 0 || batteryLevel > 100)
  ) {
    throw new AppError('Field "batteryLevel" must be a number between 0 and 100.', 400);
  }

  const sosEvent = await emergencySOSService.triggerSOS(req.user.id, {
    latitude,
    longitude,
    message,
    deviceInfo,
    batteryLevel,
  });

  res.status(201).json({ success: true, data: { sosEvent } });
});

/**
 * GET /api/sos
 */
export const getSOSEvents = asyncHandler(async (req, res) => {
  const sosEvents = await emergencySOSService.listSOSEvents(req.user.id);
  res.status(200).json({ success: true, data: { sosEvents } });
});

/**
 * GET /api/sos/:id
 */
export const getSOSEvent = asyncHandler(async (req, res) => {
  const sosEvent = await emergencySOSService.getSOSEvent(req.user.id, req.params.id);
  res.status(200).json({ success: true, data: { sosEvent } });
});

export default { createSOS, getSOSEvents, getSOSEvent };
