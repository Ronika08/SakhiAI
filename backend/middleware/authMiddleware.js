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
 * Access tokens are short-lived; an expired token returns code TOKEN_EXPIRED
 * so the client can transparently refresh (see POST /api/auth/refresh).
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
    return next(new AppError('Authentication is not available right now.', 503, null, 'AUTHENTICATION_ERROR'));
  }

  const token = extractToken(req);
  if (!token) {
    return next(new AppError('Authentication required. Please sign in.', 401, null, 'AUTHENTICATION_ERROR'));
  }

  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret, { algorithms: ['HS256'] });
    req.user = { id: decoded.id, role: decoded.role || 'user' };
    return next();
  } catch (err) {
    // TOKEN_EXPIRED lets the frontend silently use its refresh token.
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Session expired. Please sign in again.', 401, null, 'TOKEN_EXPIRED'));
    }
    return next(new AppError('Invalid authentication token.', 401, null, 'AUTHENTICATION_ERROR'));
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
    const decoded = jwt.verify(token, config.auth.jwtSecret, { algorithms: ['HS256'] });
    req.user = { id: decoded.id, role: decoded.role || 'user' };
  } catch {
    // Invalid/expired token on an optional route — proceed as anonymous.
    req.user = undefined;
  }
  return next();
}

/**
 * Authorization: allows only the listed roles (use after `protect`).
 *   router.get('/admin/...', protect, authorize('admin'), handler)
 */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required. Please sign in.', 401, null, 'AUTHENTICATION_ERROR'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to do that.', 403, null, 'AUTHORIZATION_ERROR'));
    }
    return next();
  };
}

export default { protect, optionalAuth, authorize };
