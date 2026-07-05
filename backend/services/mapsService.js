/**
 * services/mapsService.js
 *
 * Google Maps integration for the Safe Route Planning feature.
 *
 * Wraps the Google Directions API to fetch a route between two points.
 * "Safety" scoring beyond what Google returns (e.g. avoiding poorly-lit
 * areas, preferring main roads) is a future enhancement — for now this
 * provides a real, working route with distance/duration, which the
 * frontend can render on a map.
 *
 * Requires GOOGLE_MAPS_API_KEY to be set (see config/index.js — this key
 * needs to be added there; see note at the bottom of this file).
 */

import config from '../config/index.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

const DIRECTIONS_API_URL = 'https://maps.googleapis.com/maps/api/directions/json';

/**
 * Fetches a route between an origin and destination using Google's
 * Directions API.
 *
 * @param {Object} params
 * @param {{lat: number, lng: number}} params.origin
 * @param {{lat: number, lng: number}} params.destination
 * @param {'walking'|'driving'|'bicycling'|'transit'} [params.mode='walking']
 * @returns {Promise<{
 *   distanceMeters: number,
 *   durationSeconds: number,
 *   startAddress: string,
 *   endAddress: string,
 *   polyline: string,
 *   steps: Array<{ instruction: string, distanceMeters: number, durationSeconds: number }>
 * }>}
 */
async function getRoute({ origin, destination, mode = 'walking' }) {
  const apiKey = config.maps?.apiKey;

  if (!apiKey) {
    throw new AppError('Google Maps API key is not configured on the server.', 503);
  }

  if (!origin || typeof origin.lat !== 'number' || typeof origin.lng !== 'number') {
    throw new AppError('A valid "origin" with numeric lat/lng is required.', 400);
  }
  if (!destination || typeof destination.lat !== 'number' || typeof destination.lng !== 'number') {
    throw new AppError('A valid "destination" with numeric lat/lng is required.', 400);
  }

  const url = new URL(DIRECTIONS_API_URL);
  url.searchParams.set('origin', `${origin.lat},${origin.lng}`);
  url.searchParams.set('destination', `${destination.lat},${destination.lng}`);
  url.searchParams.set('mode', mode);
  url.searchParams.set('key', apiKey);

  let response;
  try {
    response = await fetch(url.toString());
  } catch (networkError) {
    logger.error(`Google Maps request failed: ${networkError.message}`);
    throw new AppError('Unable to reach the Google Maps API. Please try again.', 502);
  }

  const data = await response.json().catch(() => null);

  if (!response.ok || !data || data.status !== 'OK') {
    const providerMessage = data?.error_message || data?.status || 'Unknown error from Google Maps.';
    logger.error(`Google Maps API error: ${providerMessage}`);
    throw new AppError(`Route lookup failed: ${providerMessage}`, 502);
  }

  const route = data.routes?.[0];
  const leg = route?.legs?.[0];

  if (!route || !leg) {
    throw new AppError('No route found between the given locations.', 404);
  }

  return {
    distanceMeters: leg.distance?.value ?? null,
    durationSeconds: leg.duration?.value ?? null,
    startAddress: leg.start_address ?? null,
    endAddress: leg.end_address ?? null,
    polyline: route.overview_polyline?.points ?? null,
    steps: (leg.steps || []).map((step) => ({
      instruction: (step.html_instructions || '').replace(/<[^>]+>/g, ''),
      distanceMeters: step.distance?.value ?? null,
      durationSeconds: step.duration?.value ?? null,
    })),
  };
}

export default { getRoute };

/**
 * NOTE: config/index.js does not yet expose `config.maps.apiKey`.
 * Add the following block to the config object and env file when ready:
 *
 *   // config/index.js
 *   maps: {
 *     apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
 *   },
 *
 *   // .env.example
 *   GOOGLE_MAPS_API_KEY=
 *
 * Say `REGENERATE backend/config/index.js` and `REGENERATE backend/.env.example`
 * when you want these wired in.
 */
