/**
 * services/apiClient.js
 *
 * Single HTTP client for the SakhiAI backend.
 *
 *  - Base URL comes from VITE_API_BASE_URL (default http://localhost:5000).
 *    No secret ever lives in the frontend: the Gemini key and model are owned
 *    by the backend.
 *  - Access token is kept in memory only. The refresh token is stored in
 *    localStorage (see docs/SECURITY.md for the trade-off).
 *  - On an expired access token the client transparently calls
 *    /api/auth/refresh once (single-flight) and retries the request.
 *  - Failures are normalised into `ApiError` with a stable `code`, plus
 *    `userMessage` that is always safe to show in the UI.
 */

export const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");

const REFRESH_KEY = "sakhi_refresh_token";
const REQUEST_TIMEOUT_MS = 25000;

let accessToken = null;
let refreshPromise = null;
let onSessionExpired = () => {};

export function setSessionExpiredHandler(fn) {
  onSessionExpired = typeof fn === "function" ? fn : () => {};
}

const store = {
  get() { try { return localStorage.getItem(REFRESH_KEY); } catch { return null; } },
  set(v) { try { v ? localStorage.setItem(REFRESH_KEY, v) : localStorage.removeItem(REFRESH_KEY); } catch { /* storage unavailable */ } },
};

export function setTokens({ token, refreshToken }) {
  if (token !== undefined) accessToken = token;
  if (refreshToken !== undefined) store.set(refreshToken);
}
export function clearTokens() { accessToken = null; store.set(null); }
export function hasStoredSession() { return Boolean(store.get()); }
export function getAccessToken() { return accessToken; }

const FRIENDLY = {
  NETWORK_OFFLINE: "You appear to be offline. Your data on this device is safe — it will sync when you reconnect.",
  NETWORK_ERROR: "We couldn't reach the server. Please check your connection and try again.",
  TIMEOUT: "The request took too long. Please try again.",
  VALIDATION_ERROR: "Please check the information you entered.",
  AUTHENTICATION_ERROR: "Please sign in to continue.",
  TOKEN_EXPIRED: "Your session expired. Please sign in again.",
  AUTHORIZATION_ERROR: "You don't have permission to do that.",
  NOT_FOUND: "We couldn't find what you were looking for.",
  CONFLICT: "That already exists.",
  RATE_LIMITED: "Too many attempts. Please wait a moment and try again.",
  DATABASE_ERROR: "Account sync is temporarily unavailable. Your data on this device is safe.",
  AI_UNAVAILABLE: "The AI assistant is unavailable right now.",
  AI_TIMEOUT: "The AI assistant is taking too long. Please try again.",
  AI_RATE_LIMITED: "The AI assistant is busy. Please try again in a minute.",
  AI_BLOCKED: "The AI couldn't answer that request.",
  AI_BAD_RESPONSE: "The AI assistant sent an unusable answer. Please try again.",
  LOCATION_ERROR: "There was a problem with your location.",
  MAP_ERROR: "The maps service is unavailable right now.",
  SERVER_ERROR: "Something went wrong on our side. Please try again.",
};

export class ApiError extends Error {
  constructor({ message, code = "SERVER_ERROR", status = 0, requestId = null, details = null, data = null }) {
    super(message || FRIENDLY[code] || FRIENDLY.SERVER_ERROR);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.details = details;
    this.data = data;
  }
  /** Text that is always safe to show to a user. */
  get userMessage() {
    // Backend messages for validation/auth/conflict are written for end users.
    if (["VALIDATION_ERROR", "AUTHENTICATION_ERROR", "CONFLICT", "RATE_LIMITED", "NOT_FOUND", "AUTHORIZATION_ERROR", "LOCATION_ERROR"].includes(this.code) && this.message) {
      return this.message;
    }
    return FRIENDLY[this.code] || FRIENDLY.SERVER_ERROR;
  }
}

async function rawFetch(path, { method = "GET", body, auth = true, signal } = {}) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new ApiError({ code: "NETWORK_OFFLINE", message: FRIENDLY.NETWORK_OFFLINE });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  if (signal) signal.addEventListener("abort", () => controller.abort());

  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    throw new ApiError({
      code: err?.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR",
      message: err?.name === "AbortError" ? FRIENDLY.TIMEOUT : FRIENDLY.NETWORK_ERROR,
    });
  } finally {
    clearTimeout(timer);
  }

  let json;
  try { json = await res.json(); } catch { json = null; }

  if (!res.ok || (json && json.success === false)) {
    throw new ApiError({
      message: json?.message || json?.error,
      code: json?.code || (res.status === 401 ? "AUTHENTICATION_ERROR" : res.status === 429 ? "RATE_LIMITED" : "SERVER_ERROR"),
      status: res.status,
      requestId: json?.requestId || res.headers.get("x-request-id"),
      details: json?.details || null,
      data: json,
    });
  }
  return json;
}

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = store.get();
      if (!refreshToken) throw new ApiError({ code: "AUTHENTICATION_ERROR", status: 401 });
      const json = await rawFetch("/api/auth/refresh", { method: "POST", body: { refreshToken }, auth: false });
      setTokens({ token: json.data.token, refreshToken: json.data.refreshToken });
      return json.data;
    })().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

/**
 * Performs an API request, refreshing the session once if needed.
 * @returns {Promise<any>} the parsed `data` field of the response
 */
export async function api(path, options = {}) {
  try {
    const json = await rawFetch(path, options);
    return json.data !== undefined ? json.data : json;
  } catch (err) {
    const canRefresh =
      options.auth !== false && err instanceof ApiError && err.status === 401 &&
      ["TOKEN_EXPIRED", "AUTHENTICATION_ERROR"].includes(err.code) && !options._retried && hasStoredSession();
    if (!canRefresh) throw err;

    try {
      await refreshSession();
    } catch (refreshErr) {
      if (refreshErr instanceof ApiError && refreshErr.status === 401) {
        clearTokens();
        onSessionExpired();
      }
      throw refreshErr;
    }
    const json = await rawFetch(path, { ...options, _retried: true });
    return json.data !== undefined ? json.data : json;
  }
}

/** Restores a session at startup using the stored refresh token. */
export async function restoreSession() {
  if (!hasStoredSession()) return null;
  try {
    const data = await refreshSession();
    return data.user;
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.code === "AUTHENTICATION_ERROR")) clearTokens();
    throw err;
  }
}

export default api;
