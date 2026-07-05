/**
 * config/db.js
 *
 * MongoDB connection management via Mongoose.
 *
 * Exposes a single `connectDB()` function that server.js calls during
 * startup. Connection is optional at this stage of the project (the
 * MONGODB_URI env var may be unset in development), so this module logs
 * a clear warning and lets the app continue running without a database
 * rather than crashing — most of SakhiAI's current features don't need
 * persistence yet. Once auth/history features land, this becomes required.
 */

import mongoose from 'mongoose';
import config from './index.js';
import logger from '../utils/logger.js';

mongoose.set('strictQuery', true);

/**
 * Connects to MongoDB using the configured URI.
 * Resolves even if the URI is missing or the connection fails, so the
 * server can still boot to serve non-database features (e.g. AI chat).
 * Callers that require the database should check `isDbConnected()`.
 */
export async function connectDB() {
  const { mongoUri } = config.database;

  if (!mongoUri) {
    logger.warn('MONGODB_URI not set — starting server without a database connection.');
    return;
  }

  try {
    await mongoose.connect(mongoUri);
    logger.info('MongoDB connected successfully.');
  } catch (err) {
    logger.error(`MongoDB connection failed: ${err.message}`);
    logger.warn('Continuing to start server without a database connection.');
  }
}

/**
 * Returns true if Mongoose currently has an active connection.
 * readyState 1 === connected.
 */
export function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

/**
 * Closes the MongoDB connection cleanly. Used during graceful shutdown.
 */
export async function disconnectDB() {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.connection.close();
  logger.info('MongoDB connection closed.');
}

export default { connectDB, isDbConnected, disconnectDB };
