/**
 * server.js
 *
 * Entry point for the SakhiAI backend server.
 *
 * Responsibilities:
 *  - Bootstraps the Express application
 *  - Wires up global middleware (CORS, JSON parsing, security headers)
 *  - Mounts the central router
 *  - Attaches the global error handler
 *  - Starts the HTTP listener and handles graceful shutdown
 *
 * This file intentionally contains no business logic. Routing lives in
 * routes/, business logic in services/, and request handling in controllers/.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from './config/index.js';
import logger from './utils/logger.js';
import routes from './routes/index.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

// ---------------------------------------------------------------------------
// Global Middleware
// ---------------------------------------------------------------------------

// Security-related HTTP headers
app.use(helmet());

// Cross-origin requests (restricted to configured allowed origins)
app.use(
  cors({
    origin: config.cors.allowedOrigins,
    credentials: true,
  })
);

// Parse incoming JSON payloads
app.use(express.json({ limit: '1mb' }));

// Parse URL-encoded payloads (form submissions)
app.use(express.urlencoded({ extended: true }));

// Lightweight request logger
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'sakhiai-backend',
    environment: config.env,
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

app.use('/api', routes);

// ---------------------------------------------------------------------------
// 404 Handler (no matching route)
// ---------------------------------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
  });
});

// ---------------------------------------------------------------------------
// Global Error Handler (must be registered last)
// ---------------------------------------------------------------------------

app.use(errorHandler);

// ---------------------------------------------------------------------------
// Server Startup
// ---------------------------------------------------------------------------

const server = app.listen(config.port, () => {
  logger.info(`SakhiAI backend running on port ${config.port} [${config.env}]`);
});

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------

const shutdown = (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });

  // Force exit if shutdown takes too long
  setTimeout(() => {
    logger.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Catch unhandled errors so the process doesn't die silently
process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
});

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});

export default app;
