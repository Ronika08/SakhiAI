/**
 * services/authService.js
 *
 * Business logic for user authentication: registration, login, and JWT
 * issuance. Kept separate from controllers so HTTP concerns (status codes,
 * req/res) stay out of the logic that could, in principle, be reused
 * elsewhere (e.g. a CLI admin tool, a background job).
 */

import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import config from '../config/index.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

/**
 * Signs a JWT for a given user id.
 */
function signToken(userId) {
  if (!config.auth.jwtSecret) {
    throw new AppError('Authentication is not available right now.', 503);
  }
  return jwt.sign({ id: userId.toString() }, config.auth.jwtSecret, {
    expiresIn: config.auth.jwtExpiresIn,
  });
}

/**
 * Registers a new user.
 *
 * @param {Object} params
 * @param {string} params.name
 * @param {string} params.email
 * @param {string} params.password
 * @returns {Promise<{ user: import('../models/User.js').default, token: string }>}
 */
async function register({ name, email, password }) {
  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    throw new AppError('An account with this email already exists.', 409);
  }

  const user = await User.create({ name, email, password });
  const token = signToken(user._id);

  logger.info(`New user registered: ${user.email}`);
  return { user, token };
}

/**
 * Authenticates a user by email/password.
 *
 * @param {Object} params
 * @param {string} params.email
 * @param {string} params.password
 * @returns {Promise<{ user: import('../models/User.js').default, token: string }>}
 */
async function login({ email, password }) {
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

  // Use the same generic error for "no such user" and "wrong password"
  // to avoid leaking which emails are registered.
  if (!user) {
    throw new AppError('Invalid email or password.', 401);
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new AppError('Invalid email or password.', 401);
  }

  if (!user.isActive) {
    throw new AppError('This account has been deactivated.', 403);
  }

  const token = signToken(user._id);
  logger.info(`User logged in: ${user.email}`);
  return { user, token };
}

/**
 * Fetches the current user by id (used by "get my profile" style routes,
 * typically after `protect` middleware has decoded the token).
 */
async function getCurrentUser(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found.', 404);
  }
  return user;
}

export default { register, login, getCurrentUser };
