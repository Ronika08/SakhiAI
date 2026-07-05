/**
 * middleware/authMiddleware.js
 *
 * JWT-based route protection.
 *
 * Attach `protect` to any route that requires an authenticated user.
 * It expects a bearer token in the `Authorization` header:
 *   Authorization: Bearer <token>
 *
 * On success, the decoded token payload is attached to `req.user` for
 * downstream handlers to use. On failure, it forwards an AppError to the
 * global error handler rather than responding directly, keeping error
 * formatting consistent across the app.
 *
 * Note: no user routes/controllers exist yet (auth is still a pending
 * feature per the project roadmap). This middleware is ready to protect
 * routes as soon as registration/login endpoints are added.
 */

import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { AppError } from './errorHandler.js';
import logger from '../utils/logger.js';

/**
 * Extracts the bearer token from the Authorization header, if present.
 */
function extractToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

/**
 * Requires a valid JWT. Rejects the request with 401 if missing/invalid/expired.
 */
export function protect(req, res, next) {
  if (!config.auth.jwtSecret) {
    logger.error('JWT_SECRET is not configured — cannot verify tokens.');
    return next(new AppError('Authentication is not available right now.', 503));
  }

  const token = extractToken(req);
  if (!token) {
    return next(new AppError('Authentication required. No token provided.', 401));
  }

  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret);
    req.user = decoded;
    return next();
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError' ? 'Session expired. Please log in again.' : 'Invalid authentication token.';
    return next(new AppError(message, 401));
  }
}

/**
 * Like `protect`, but never rejects the request — if a valid token is
 * present it populates `req.user`, otherwise `req.user` stays undefined
 * and the request continues. Useful for routes that behave differently
 * for logged-in vs anonymous users without requiring auth outright.
 */
export function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (!token || !config.auth.jwtSecret) return next();

  try {
    req.user = jwt.verify(token, config.auth.jwtSecret);
  } catch {
    // Invalid/expired token on an optional route — proceed as anonymous.
    req.user = undefined;
  }
  return next();
}

export default { protect, optionalAuth };
