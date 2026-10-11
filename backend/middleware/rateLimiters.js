/**
 * middleware/rateLimiters.js
 *
 * Rate limiting via express-rate-limit. Limits are per client IP (set
 * TRUST_PROXY correctly behind a reverse proxy). Disabled when
 * NODE_ENV=test so automated tests are deterministic.
 */

import rateLimit from 'express-rate-limit';
import config from '../config/index.js';

function build({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => config.env === 'test',
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message,
        code: 'RATE_LIMITED',
        requestId: req.id || null,
      });
    },
  });
}

const MINUTE = 60 * 1000;

export const apiLimiter = build({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: 'Too many requests. Please slow down and try again shortly.',
});

export const authLimiter = build({
  windowMs: 15 * MINUTE,
  max: 20,
  message: 'Too many sign-in attempts. Please wait a few minutes and try again.',
});

export const passwordResetLimiter = build({
  windowMs: 60 * MINUTE,
  max: 5,
  message: 'Too many password-reset requests. Please try again later.',
});

export const chatLimiter = build({
  windowMs: 10 * MINUTE,
  max: 40,
  message: 'You are sending messages too quickly. Please wait a moment.',
});

export const sosLimiter = build({
  windowMs: 10 * MINUTE,
  max: 15,
  message: 'Too many SOS requests in a short time. If you are in danger, call your local emergency number now.',
});

export const voiceLimiter = build({
  windowMs: 10 * MINUTE,
  max: 20,
  message: 'Too many voice requests. Please wait a moment and try again.',
});

export default { apiLimiter, authLimiter, passwordResetLimiter, chatLimiter, sosLimiter, voiceLimiter };
