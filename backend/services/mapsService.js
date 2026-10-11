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
const GEOCODE_API_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const MAPS_TIMEOUT_MS = 10000;

/** fetch with a hard timeout; maps failures are categorised, never leaking the key-bearing URL. */
async function mapsFetch(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MAPS_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (err) {
    logger.error(`Google Maps request failed: ${err.name === 'AbortError' ? 'timeout' : 'network error'}`);
    throw new AppError(
      err.name === 'AbortError' ? 'The maps service took too long to respond.' : 'Unable to reach the maps service. Please try again.',
      err.name === 'AbortError' ? 504 : 502,
      null,
      'NETWORK_ERROR'
    );
  } finally {
    clearTimeout(timer);
  }
}

function throwForStatus(providerStatus, data) {
  logger.error(`Google Maps API error: ${providerStatus} ${data?.error_message || ''}`);
  if (providerStatus === 'OVER_QUERY_LIMIT' || providerStatus === 'OVER_DAILY_LIMIT') {
    throw new AppError('The maps service is busy right now. Please try again later.', 429, null, 'MAP_ERROR');
  }
  if (providerStatus === 'REQUEST_DENIED' || (providerStatus === 'INVALID_REQUEST' && /key/i.test(data?.error_message || ''))) {
    throw new AppError('Route planning is not available right now.', 503, null, 'MAP_ERROR');
  }
  if (providerStatus === 'ZERO_RESULTS' || providerStatus === 'NOT_FOUND') {
    throw new AppError('No route could be found between those locations.', 404, null, 'MAP_ERROR');
  }
  throw new AppError('Route lookup failed. Please try again.', 502, null, 'MAP_ERROR');
}

/** Resolves a free-text address to coordinates (server-side Geocoding API; the key never leaves the server). */
async function geocodeAddress(address) {
  const apiKey = config.maps?.apiKey;
  if (!apiKey) throw new AppError('Route planning is not available right now.', 503, null, 'MAP_ERROR');
  const url = new URL(GEOCODE_API_URL);
  url.searchParams.set('address', address);
  url.searchParams.set('region', 'in');
  url.searchParams.set('key', apiKey);
  const response = await mapsFetch(url.toString());
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || data.status !== 'OK') {
    if (data?.status === 'ZERO_RESULTS') throw new AppError(`We couldn't find "${address.slice(0, 60)}". Try a more specific place name.`, 404, null, 'MAP_ERROR');
    throwForStatus(data?.status || `HTTP ${response.status}`, data);
  }
  const loc = data.results?.[0]?.geometry?.location;
  if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') {
    throw new AppError('That place could not be located.', 404, null, 'MAP_ERROR');
  }
  return { lat: loc.lat, lng: loc.lng };
}

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
    throw new AppError('Route planning is not available right now.', 503, null, 'MAP_ERROR');
  }

  if (!origin || typeof origin.lat !== 'number' || typeof origin.lng !== 'number') {
    throw new AppError('A valid "origin" with numeric lat/lng is required.', 400, null, 'LOCATION_ERROR');
  }
  if (!destination || typeof destination.lat !== 'number' || typeof destination.lng !== 'number') {
    throw new AppError('A valid "destination" with numeric lat/lng is required.', 400, null, 'LOCATION_ERROR');
  }

  const url = new URL(DIRECTIONS_API_URL);
  url.searchParams.set('origin', `${origin.lat},${origin.lng}`);
  url.searchParams.set('destination', `${destination.lat},${destination.lng}`);
  url.searchParams.set('mode', mode);
  url.searchParams.set('key', apiKey);

  const response = await mapsFetch(url.toString());

  const data = await response.json().catch(() => null);

  if (!response.ok || !data || data.status !== 'OK') {
    throwForStatus(data?.status || `HTTP ${response.status}`, data);
  }

  const route = data.routes?.[0];
  const leg = route?.legs?.[0];

  if (!route || !leg) {
    throw new AppError('No route found between the given locations.', 404, null, 'MAP_ERROR');
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

export default { getRoute, geocodeAddress };

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
