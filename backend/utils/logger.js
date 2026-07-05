/**
 * utils/logger.js
 *
 * Lightweight, dependency-free leveled logger.
 *
 * Every other backend file logs through this module instead of calling
 * console.* directly, so log formatting/behavior (timestamps, levels,
 * production filtering) is controlled from a single place. Swapping this
 * for a library like Winston or Pino later only requires changing this
 * file — the rest of the codebase already depends on the `logger.info/
 * warn/error/debug` interface.
 */

import config from '../config/index.js';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const currentLevel = LEVELS[config.logging.level] ?? LEVELS.info;

function timestamp() {
  return new Date().toISOString();
}

function format(level, message) {
  return `[${timestamp()}] [${level.toUpperCase()}] ${message}`;
}

function log(level, message, ...meta) {
  if (LEVELS[level] > currentLevel) return;

  const line = format(level, message);
  const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';

  if (meta.length) {
    // eslint-disable-next-line no-console
    console[consoleMethod](line, ...meta);
  } else {
    // eslint-disable-next-line no-console
    console[consoleMethod](line);
  }
}

const logger = {
  error: (message, ...meta) => log('error', message, ...meta),
  warn: (message, ...meta) => log('warn', message, ...meta),
  info: (message, ...meta) => log('info', message, ...meta),
  debug: (message, ...meta) => log('debug', message, ...meta),
};

export default logger;
