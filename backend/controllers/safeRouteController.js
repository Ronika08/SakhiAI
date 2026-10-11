/**
 * controllers/safeRouteController.js
 *
 * HTTP layer for the Safe Route Planning feature. Delegates the actual
 * Google Maps lookup to services/mapsService.js. Requires authentication
 * since route requests are tied to a specific user's trip context.
 */

import { AppError } from '../middleware/errorHandler.js';
import mapsService from '../services/mapsService.js';

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const VALID_MODES = ['walking', 'driving', 'bicycling', 'transit'];

/**
 * Validates a { lat, lng } coordinate object from the request body.
 */
/**
 * Accepts { lat, lng } or { address: "text" }. Addresses are geocoded on the
 * server so the Maps key never reaches the browser.
 */
async function resolveLocation(value, fieldName) {
  if (value && typeof value === 'object' && !Array.isArray(value) && typeof value.address === 'string') {
    const address = value.address.trim();
    if (address.length < 3 || address.length > 200) {
      throw new AppError(`Field "${fieldName}.address" must be 3-200 characters.`, 400, null, 'LOCATION_ERROR');
    }
    return mapsService.geocodeAddress(address);
  }
  return validateCoordinate(value, fieldName);
}

function validateCoordinate(value, fieldName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError(`Field "${fieldName}" is required and must be an object with lat/lng.`, 400, null, 'LOCATION_ERROR');
  }

  const { lat, lng } = value;

  if (typeof lat !== 'number' || lat < -90 || lat > 90) {
    throw new AppError(`Field "${fieldName}.lat" must be a number between -90 and 90.`, 400);
  }
  if (typeof lng !== 'number' || lng < -180 || lng > 180) {
    throw new AppError(`Field "${fieldName}.lng" must be a number between -180 and 180.`, 400);
  }

  return { lat, lng };
}

/**
 * POST /api/routes/plan
 * Body: { origin: {lat, lng}, destination: {lat, lng}, mode? }
 */
export const planRoute = asyncHandler(async (req, res) => {
  const { origin, destination, mode } = req.body;

  const validOrigin = await resolveLocation(origin, 'origin');
  const validDestination = await resolveLocation(destination, 'destination');

  if (mode !== undefined && !VALID_MODES.includes(mode)) {
    throw new AppError(`Field "mode" must be one of: ${VALID_MODES.join(', ')}.`, 400);
  }

  const route = await mapsService.getRoute({
    origin: validOrigin,
    destination: validDestination,
    mode: mode || 'walking',
  });

  res.status(200).json({ success: true, data: { route } });
});

export default { planRoute };
