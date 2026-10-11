/**
 * middleware/requestContext.js
 *
 * Assigns every request an ID (returned as `X-Request-Id`), stores it in
 * AsyncLocalStorage so all log lines carry it, and logs one structured line
 * per request when the response finishes: method, path, status, duration,
 * and authenticated user ID (never the query string — it may hold tokens).
 */

import { randomUUID } from 'node:crypto';
import { requestStore } from '../utils/requestStore.js';
import logger from '../utils/logger.js';

const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

export default function requestContext(req, res, next) {
  const incoming = req.headers['x-request-id'];
  const requestId = typeof incoming === 'string' && SAFE_ID.test(incoming) ? incoming : randomUUID();
  const store = { requestId, userId: null };

  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);

  const started = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    store.userId = req.user?.id || null;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level](
      `${req.method} ${(req.baseUrl || '') + req.path} ${res.statusCode} ${durationMs.toFixed(1)}ms` +
        (req.aiProvider ? ` provider=${req.aiProvider}` : '') +
        (store.userId ? ` user=${store.userId}` : '')
    );
  });

  requestStore.run(store, () => {
    // Keep store.userId current once auth middleware sets req.user.
    Object.defineProperty(store, 'userId', {
      get: () => req.user?.id || null,
      set: () => {},
      enumerable: true,
      configurable: true,
    });
    next();
  });
}
