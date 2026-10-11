/**
 * services/locationService.js
 *
 * Geolocation + reverse-geocoding helpers with explicit error handling.
 *
 * `getPreciseLocation()` never throws. It resolves to
 *   { ok: true,  location: {lat,lng,accuracy,timestamp}, quality, warning? }
 *   { ok: false, code, message }
 * where code ∈ UNSUPPORTED | PERMISSION_DENIED | UNAVAILABLE | TIMEOUT | INVALID
 */

export const LOCATION_MESSAGES = {
  UNSUPPORTED: "This device or browser does not support location.",
  PERMISSION_DENIED: "Location permission is blocked. Enable it in your browser/site settings, then tap Retry.",
  UNAVAILABLE: "Your location could not be determined. Move to an open area or check that GPS is on, then retry.",
  TIMEOUT: "Getting your location took too long. Check your GPS/signal and retry.",
  INVALID: "The location we received looks invalid. Please retry.",
};

export function classifyAccuracy(accuracy) {
  if (typeof accuracy !== "number" || !Number.isFinite(accuracy)) return "unknown";
  if (accuracy <= 100) return "good";
  if (accuracy <= 1000) return "low";
  return "poor";
}

export function isValidCoordinate(lat, lng) {
  return (
    typeof lat === "number" && typeof lng === "number" &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

function once(options) {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ ok: false, code: "UNSUPPORTED", message: LOCATION_MESSAGES.UNSUPPORTED });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        if (!isValidCoordinate(lat, lng)) {
          resolve({ ok: false, code: "INVALID", message: LOCATION_MESSAGES.INVALID });
          return;
        }
        resolve({
          ok: true,
          location: { lat, lng, accuracy, timestamp: pos.timestamp || Date.now() },
          quality: classifyAccuracy(accuracy),
        });
      },
      (err) => {
        const code = err?.code === 1 ? "PERMISSION_DENIED" : err?.code === 3 ? "TIMEOUT" : "UNAVAILABLE";
        resolve({ ok: false, code, message: LOCATION_MESSAGES[code] });
      },
      options
    );
  });
}

/**
 * High-accuracy first; if that times out/fails (not permission-denied) a
 * quick low-accuracy / cached attempt is made so an emergency still gets a
 * position when GPS is slow.
 */
export async function getPreciseLocation({ timeoutMs = 10000 } = {}) {
  const first = await once({ enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 });
  if (first.ok || first.code === "PERMISSION_DENIED" || first.code === "UNSUPPORTED") return withWarning(first);

  const second = await once({ enableHighAccuracy: false, timeout: 6000, maximumAge: 120000 });
  return second.ok ? withWarning(second) : first;
}

function withWarning(result) {
  if (result.ok && result.quality === "poor") {
    return { ...result, warning: "Your location is very approximate (over 1 km). The map may be inaccurate." };
  }
  if (result.ok && result.quality === "low") {
    return { ...result, warning: "Your location accuracy is low." };
  }
  return result;
}

export async function getAddressFromCoordinates(lat, lng) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      { signal: controller.signal }
    );
    if (!response.ok) return "Unable to fetch address";
    const data = await response.json();
    return data.display_name || "Address not found";
  } catch {
    return "Unable to fetch address";
  } finally {
    clearTimeout(timer);
  }
}
