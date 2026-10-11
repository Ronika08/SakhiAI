/**
 * services/connectivity.js
 *
 * Online/offline awareness for the offline-first architecture.
 *
 * `navigator.onLine` only says whether the device has a network interface, not
 * whether the internet or our server is reachable. So state is derived from:
 *   1. navigator.onLine (immediate)
 *   2. recent request outcomes reported via `reportNetworkFailure()` /
 *      `reportNetworkSuccess()`
 *   3. a lightweight ping of the backend `/health` while we believe we are
 *      offline, so reconnection is noticed without a page reload
 *
 * States: "online" | "offline" (no device network) | "server_unreachable"
 */
import { API_BASE_URL } from "./apiClient";

const listeners = new Set();
let state = typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "online";
let pingTimer = null;

export const getConnectivity = () => state;
export const isOnline = () => state === "online" && (typeof navigator === "undefined" || navigator.onLine !== false);

function set(next) {
  if (next === state) return;
  state = next;
  listeners.forEach((fn) => { try { fn(state); } catch { /* listener errors must not break connectivity */ } });
}

export function subscribeConnectivity(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const reportNetworkSuccess = () => set("online");
export function reportNetworkFailure() {
  set(typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "server_unreachable");
  schedulePing();
}

/** One backend health probe (3 s timeout). Never throws. */
export async function pingBackend({ fetchImpl = globalThis.fetch, timeoutMs = 3000 } = {}) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) { set("offline"); return false; }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${API_BASE_URL}/health`, { cache: "no-store", signal: controller.signal });
    if (res.ok) { set("online"); return true; }
    set("server_unreachable");
    return false;
  } catch {
    set(typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "server_unreachable");
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function schedulePing() {
  if (pingTimer || typeof window === "undefined") return;
  pingTimer = setTimeout(async () => {
    pingTimer = null;
    const ok = await pingBackend();
    if (!ok) schedulePing();
  }, 20000);
}

/** Wires browser online/offline events. Call once at app start; returns a cleanup function. */
export function startConnectivityMonitor() {
  if (typeof window === "undefined") return () => {};
  const onOnline = () => { set("online"); pingBackend(); };
  const onOffline = () => set("offline");
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    if (pingTimer) { clearTimeout(pingTimer); pingTimer = null; }
  };
}

/** Test helper. */
export function _resetConnectivity() {
  state = typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "online";
  listeners.clear();
  if (pingTimer) { clearTimeout(pingTimer); pingTimer = null; }
}
