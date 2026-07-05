/**
 * controllers/authController.js
 *
 * HTTP request/response layer for authentication. Validates input and
 * delegates all actual logic (hashing, token signing, DB lookups) to
 * services/authService.js — this file stays focused on shaping requests
 * and responses.
 */

import { AppError } from '../middleware/errorHandler.js';
import authService from '../services/authService.js';

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/auth/register
 * Body: { name, email, password }
 */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new AppError('Field "name" is required.', 400);
  }
  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    throw new AppError('A valid "email" is required.', 400);
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    throw new AppError('Field "password" must be at least 8 characters long.', 400);
  }

  const { user, token } = await authService.register({
    name: name.trim(),
    email: email.trim(),
    password,
  });

  res.status(201).json({
    success: true,
    data: { user, token },
  });
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || typeof email !== 'string') {
    throw new AppError('Field "email" is required.', 400);
  }
  if (!password || typeof password !== 'string') {
    throw new AppError('Field "password" is required.', 400);
  }

  const { user, token } = await authService.login({ email: email.trim(), password });

  res.status(200).json({
    success: true,
    data: { user, token },
  });
});

/**
 * GET /api/auth/me
 * Requires the `protect` auth middleware to have run first (sets req.user).
 */
export const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id);

  res.status(200).json({
    success: true,
    data: { user },
  });
});

export default { register, login, getMe };
