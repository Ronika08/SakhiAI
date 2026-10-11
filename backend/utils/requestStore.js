/**
 * utils/requestStore.js
 *
 * AsyncLocalStorage holding per-request context (request ID, user ID) so the
 * logger can attach it to every log line without passing it around.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export const requestStore = new AsyncLocalStorage();

export function getRequestContext() {
  return requestStore.getStore() || {};
}

export default { requestStore, getRequestContext };
