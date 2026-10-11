/**
 * middleware/errorHandler.js
 *
 * Global Express error-handling middleware.
 *
 * Any error passed to `next(err)` ends up here. This is the single place
 * responsible for logging, normalizing the response shape, and making sure
 * internal details (stack traces, raw provider/DB messages) never reach the
 * client.
 *
 * Response shape (backward compatible — `success` and `message` are kept):
 *   { success: false, message, code, requestId, details? }
 *
 * `code` is a stable error category the frontend can branch on:
 *   VALIDATION_ERROR, AUTHENTICATION_ERROR, AUTHORIZATION_ERROR, NOT_FOUND,
 *   CONFLICT, RATE_LIMITED, AI_UNAVAILABLE, AI_TIMEOUT, AI_RATE_LIMITED,
 *   DATABASE_ERROR, LOCATION_ERROR, MAP_ERROR, NETWORK_ERROR, SERVER_ERROR
 */

import logger from '../utils/logger.js';
import config from '../config/index.js';
import { getRequestContext } from '../utils/requestStore.js';

function defaultCodeForStatus(status) {
  if (status === 400 || status === 422) return 'VALIDATION_ERROR';
  if (status === 401) return 'AUTHENTICATION_ERROR';
  if (status === 403) return 'AUTHORIZATION_ERROR';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 413) return 'PAYLOAD_TOO_LARGE';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 502 || status === 504) return 'NETWORK_ERROR';
  return 'SERVER_ERROR';
}

/**
 * AppError
 *
 * Raise errors with an intentional HTTP status code and a client-safe
 * message, e.g.:  throw new AppError('Message is required', 400);
 * Optionally pass a category: new AppError('...', 503, null, 'AI_UNAVAILABLE')
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, details = null, code = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    this.code = code || defaultCodeForStatus(statusCode);
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Translates well-known third-party errors (Mongoose, body-parser, CORS)
 * into AppErrors with safe messages. Returns null if not recognised.
 */
function normalizeKnownError(err) {
  if (err.name === 'ValidationError' && err.errors) {
    const details = Object.values(err.errors).map((e) => e.message);
    return new AppError('Validation failed.', 400, details, 'VALIDATION_ERROR');
  }
  if (err.name === 'CastError') {
    return new AppError('Invalid identifier or value supplied.', 400, null, 'VALIDATION_ERROR');
  }
  if (err.code === 11000) {
    return new AppError('A record with these details already exists.', 409, null, 'CONFLICT');
  }
  if (err.type === 'entity.parse.failed') {
    return new AppError('Request body is not valid JSON.', 400, null, 'VALIDATION_ERROR');
  }
  if (err.type === 'entity.too.large') {
    return new AppError('Request body is too large.', 413, null, 'PAYLOAD_TOO_LARGE');
  }
  if (err.message === 'Origin not allowed by CORS') {
    return new AppError('Origin not allowed.', 403, null, 'AUTHORIZATION_ERROR');
  }
  if (/^Mongo|^Mongoose/.test(err.name || '')) {
    return new AppError(
      'The database is temporarily unavailable. Please try again.',
      503,
      null,
      'DATABASE_ERROR'
    );
  }
  return null;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const normalized = err instanceof AppError ? err : normalizeKnownError(err);
  const appError = normalized || err;

  const statusCode =
    appError.statusCode && Number.isInteger(appError.statusCode) ? appError.statusCode : 500;
  const isOperational = appError.isOperational === true;
  const code = appError.code && typeof appError.code === 'string' ? appError.code : defaultCodeForStatus(statusCode);
  const { requestId } = getRequestContext();

  // Full technical detail is logged server-side only (and redacted by logger).
  const logLine = `${req.method} ${(req.baseUrl || '') + req.path} -> ${statusCode} [${code}] ${err.message}`;
  if (statusCode >= 500) {
    logger.error(logLine, config.isProduction ? undefined : err.stack);
  } else {
    logger.warn(logLine);
  }

  const response = {
    success: false,
    message: isOperational ? appError.message : 'Something went wrong on our side. Please try again.',
    code,
    requestId: requestId || null,
  };

  if (isOperational && appError.details) {
    response.details = appError.details;
  }

  res.status(statusCode).json(response);
}

export default errorHandler;
