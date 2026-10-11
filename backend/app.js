/**
 * app.js
 *
 * Builds and exports the configured Express application WITHOUT starting a
 * listener, so automated tests (supertest) can import it. server.js is the
 * process entry point that connects the database and calls `listen`.
 *
 * Middleware order matters:
 *   request context (ID + logging) → helmet → CORS → compression →
 *   body parsing (size-limited) → sanitisation → rate limit → routes →
 *   404 → error handler.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import config from './config/index.js';
import routes from './routes/index.js';
import errorHandler, { AppError } from './middleware/errorHandler.js';
import requestContext from './middleware/requestContext.js';
import { sanitizeInput } from './middleware/validate.js';
import { apiLimiter } from './middleware/rateLimiters.js';
import { pingDB } from './config/db.js';

const app = express();

app.disable('x-powered-by');
if (config.trustProxy) app.set('trust proxy', config.trustProxy);

// Request ID + structured request logging (first, so every log line has an ID)
app.use(requestContext);

// Security headers. The API serves JSON only, so a strict CSP is safe.
app.use(
  helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'no-referrer' },
    hsts: config.isProduction ? { maxAge: 15552000, includeSubDomains: true } : false,
  })
);

// Strict CORS: only configured origins. Requests with no Origin header
// (curl, server-to-server, health probes) are allowed.
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.cors.allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'RateLimit-Remaining', 'Retry-After'],
    maxAge: 600,
  })
);

app.use(compression());

// Payload limits (JSON API only: 100 KB is ample for every endpoint, except
// the optional audio upload which is parsed by its own 3 MB route parser).
app.use((req, res, next) => (req.path === '/api/voice/transcribe' ? next() : express.json({ limit: '100kb' })(req, res, next)));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));

// NoSQL-injection / control-character sanitisation
app.use(sanitizeInput);

// ---------------------------------------------------------------------------
// Health / readiness (not rate limited; no sensitive data)
// ---------------------------------------------------------------------------

/** Liveness: the process is up. */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'sakhiai-backend',
    environment: config.env,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

/** Readiness: dependencies are usable (database connected when configured). */
app.get('/ready', async (req, res) => {
  const dbConfigured = Boolean(config.database.mongoUri);
  const dbOk = dbConfigured ? await pingDB() : false;
  const aiProviderKey = config.ai[config.ai.defaultProvider]?.apiKey;
  const checks = {
    database: dbConfigured ? (dbOk ? 'up' : 'down') : 'not_configured',
    aiProvider: aiProviderKey ? 'configured' : 'not_configured',
    jwtSecret: config.auth.jwtSecret ? 'configured' : 'not_configured',
  };
  const ready = !dbConfigured || dbOk;
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', checks });
});

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

app.use('/api', apiLimiter, routes);

app.use((req, res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.path}`, 404, null, 'NOT_FOUND'));
});

app.use(errorHandler);

export default app;
