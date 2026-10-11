/**
 * middleware/validate.js
 *
 * Dependency-free request validation + input sanitization.
 *
 *  - `sanitizeInput`  : global middleware. Removes NoSQL-injection operators
 *                       (keys starting with "$" or containing "."), strips
 *                       null bytes / control characters from strings and
 *                       trims them. Applied to body, query and params.
 *  - `validate(schema)`: route-level schema check producing a consistent
 *                       400 VALIDATION_ERROR listing every problem.
 *
 * Schema example:
 *   validate({ body: { email: { type: 'email', required: true },
 *                      age:   { type: 'number', min: 0, max: 120 } } })
 */

import { AppError } from './errorHandler.js';

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function cleanString(value) {
  return value.replace(CONTROL_CHARS, '').trim();
}

export function sanitizeValue(value, depth = 0) {
  if (depth > 10) return undefined;
  if (typeof value === 'string') return cleanString(value);
  if (Array.isArray(value)) return value.map((v) => sanitizeValue(v, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor') continue;
      out[key] = sanitizeValue(val, depth + 1);
    }
    return out;
  }
  return value;
}

export function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === 'object') req.body = sanitizeValue(req.body);
  if (req.query && typeof req.query === 'object') {
    const cleaned = sanitizeValue({ ...req.query });
    Object.keys(req.query).forEach((k) => delete req.query[k]);
    Object.assign(req.query, cleaned);
  }
  if (req.params && typeof req.params === 'object') req.params = sanitizeValue(req.params);
  next();
}

function checkField(name, value, rule, errors) {
  const missing = value === undefined || value === null || value === '';
  if (missing) {
    if (rule.required) errors.push(`Field "${name}" is required.`);
    return;
  }

  switch (rule.type) {
    case 'string':
    case 'email': {
      if (typeof value !== 'string') return errors.push(`Field "${name}" must be a string.`);
      if (rule.type === 'email' && !EMAIL_REGEX.test(value)) {
        return errors.push(`Field "${name}" must be a valid email address.`);
      }
      if (rule.min && value.length < rule.min) errors.push(`Field "${name}" must be at least ${rule.min} characters.`);
      if (rule.max && value.length > rule.max) errors.push(`Field "${name}" must be at most ${rule.max} characters.`);
      if (rule.pattern && !rule.pattern.test(value)) errors.push(rule.patternMessage || `Field "${name}" has an invalid format.`);
      break;
    }
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return errors.push(`Field "${name}" must be a number.`);
      if (rule.min !== undefined && value < rule.min) errors.push(`Field "${name}" must be at least ${rule.min}.`);
      if (rule.max !== undefined && value > rule.max) errors.push(`Field "${name}" must be at most ${rule.max}.`);
      break;
    }
    case 'boolean':
      if (typeof value !== 'boolean') errors.push(`Field "${name}" must be true or false.`);
      break;
    case 'array':
      if (!Array.isArray(value)) return errors.push(`Field "${name}" must be an array.`);
      if (rule.max !== undefined && value.length > rule.max) errors.push(`Field "${name}" has too many items (max ${rule.max}).`);
      break;
    case 'date':
      if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) errors.push(`Field "${name}" must be a valid date.`);
      break;
    case 'object':
      if (typeof value !== 'object' || Array.isArray(value)) errors.push(`Field "${name}" must be an object.`);
      break;
    default:
      break;
  }

  if (rule.enum && !rule.enum.includes(value)) {
    errors.push(`Field "${name}" must be one of: ${rule.enum.join(', ')}.`);
  }
}

export function validate(schema) {
  return (req, res, next) => {
    const errors = [];
    for (const location of ['body', 'query', 'params']) {
      const rules = schema[location];
      if (!rules) continue;
      const source = req[location] || {};
      for (const [name, rule] of Object.entries(rules)) {
        checkField(name, source[name], rule, errors);
      }
    }
    if (errors.length) {
      return next(new AppError(errors[0], 400, errors, 'VALIDATION_ERROR'));
    }
    return next();
  };
}

export default { validate, sanitizeInput, sanitizeValue, cleanString };
