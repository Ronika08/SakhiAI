/**
 * middleware/requireDb.js
 *
 * Guards database-backed routes. If MongoDB is not connected the request
 * fails fast with 503 DATABASE_ERROR instead of hanging until Mongoose's
 * buffering timeout. Stateless routes (chat, health tips) are not guarded,
 * so they keep working without a database.
 */

import { AppError } from './errorHandler.js';
import { isDbConnected } from '../config/db.js';

export default function requireDb(req, res, next) {
  if (isDbConnected()) return next();
  return next(
    new AppError(
      'Account and sync features are temporarily unavailable. Your data on this device is safe.',
      503,
      null,
      'DATABASE_ERROR'
    )
  );
}
