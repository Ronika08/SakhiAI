/**
 * middleware/errorHandler.js
 *
 * Global Express error-handling middleware.
 *
 * Any error passed to `next(err)` anywhere in the app (controllers,
 * services, other middleware) ends up here. This is the single place
 * responsible for:
 *   - Logging the error
 *   - Normalizing the error into a consistent JSON response shape
 *   - Hiding internal details (stack traces, raw messages) in production
 *
 * Controllers/services should throw or forward an `AppError` (see below)
 * when they want to control the HTTP status code and message shown to
 * the client. Unexpected errors default to a generic 500 response.
 */

import logger from '../utils/logger.js';
import config from '../config/index.js';

/**
 * AppError
 *
 * Use this class to raise errors with an intentional HTTP status code
 * and a client-safe message, e.g.:
 *   throw new AppError('Message is required', 400);
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Express error-handling middleware.
 * Must be registered last, after all routes, and must keep the 4-arg
 * signature (err, req, res, next) so Express recognizes it as an
 * error handler.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const isOperational = err.isOperational === true;

  // Log full detail server-side regardless of what we expose to the client.
  logger.error(
    `${req.method} ${req.originalUrl} -> ${statusCode} ${err.message}`,
    config.isProduction ? undefined : err.stack
  );

  const response = {
    success: false,
    message: isOperational || !config.isProduction ? err.message : 'Internal server error',
  };

  // Include extra details only when explicitly provided and safe to share.
  if (err.details) {
    response.details = err.details;
  }

  // Include stack trace only outside production to aid local debugging.
  if (!config.isProduction) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

export default errorHandler;
