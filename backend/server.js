/**
 * server.js
 *
 * Process entry point for the SakhiAI backend.
 *
 *  - validates production configuration (fail fast)
 *  - connects to MongoDB (the server still boots without it so stateless
 *    features such as chat and health tips keep working)
 *  - starts the HTTP listener and the missed-check-in monitor
 *  - handles graceful shutdown (SIGTERM / SIGINT)
 *
 * The Express application itself is built in app.js.
 */

import config from './config/index.js';
import logger from './utils/logger.js';
import app from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { startCheckInMonitor, stopCheckInMonitor } from './services/checkInMonitor.js';

function assertProductionConfig() {
  if (!config.isProduction) return;
  const problems = [];
  if (!config.auth.jwtSecret || config.auth.jwtSecret.length < 32) {
    problems.push('JWT_SECRET must be set to a random string of at least 32 characters.');
  }
  if (!config.database.mongoUri) problems.push('MONGODB_URI must be set.');
  if (config.cors.allowedOrigins.some((o) => o.includes('localhost'))) {
    logger.warn('CORS_ALLOWED_ORIGINS contains localhost while NODE_ENV=production.');
  }
  if (problems.length) {
    problems.forEach((p) => logger.error(`Config error: ${p}`));
    process.exit(1);
  }
}

assertProductionConfig();

await connectDB();

const server = app.listen(config.port, () => {
  logger.info(`SakhiAI backend running on port ${config.port} [${config.env}]`);
  logger.info(`AI provider: ${config.ai.defaultProvider} (model configured on server)`);
});

startCheckInMonitor();

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

let shuttingDown = false;

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received. Shutting down gracefully...`);

  const force = setTimeout(() => {
    logger.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
  force.unref();

  stopCheckInMonitor();
  server.close(async () => {
    logger.info('HTTP server closed.');
    await disconnectDB().catch(() => {});
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${reason instanceof Error ? reason.message : reason}`);
});

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});
