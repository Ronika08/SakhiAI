/**
 * services/authService.js
 *
 * Authentication business logic: registration, login (with lockout),
 * refresh-token rotation, logout, forgot/reset/change password and profile.
 *
 * Security notes
 *  - Passwords hashed with bcrypt (rounds from config) by the User model.
 *  - Login returns one generic error for unknown e-mail / wrong password and
 *    performs a dummy bcrypt comparison for unknown users (timing hardening).
 *  - 5 failed attempts lock the account for 15 minutes.
 *  - forgotPassword never reveals whether an e-mail is registered.
 *  - Reset tokens are single-use, hashed at rest, and expire; a successful
 *    reset revokes every refresh token for the user.
 */

import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import PasswordReset from '../models/PasswordReset.js';
import config from '../config/index.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';
import { validatePassword } from '../utils/passwordPolicy.js';
import tokenService from './tokenService.js';
import { sendEmail, isEmailConfigured } from './notificationProviders/emailProvider.js';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
// Valid bcrypt hash of a random string; used to equalise login timing.
const DUMMY_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEeO5Hq1Qm0sY0bDn6c9mJrXG4eVQ1kU7Ge';

function assertStrongPassword(password, context) {
  const problems = validatePassword(password, context);
  if (problems.length) throw new AppError(problems[0], 400, problems, 'VALIDATION_ERROR');
}

async function buildSession(user, { userAgent } = {}) {
  const token = tokenService.signAccessToken(user);
  const refreshToken = await tokenService.issueRefreshToken(user, { userAgent });
  return { user, token, refreshToken, expiresIn: tokenService.accessTokenTtlSeconds() };
}

async function register({ name, email, password }, meta = {}) {
  assertStrongPassword(password, { email, name });

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    throw new AppError('An account with this email already exists.', 409, null, 'CONFLICT');
  }

  const user = await User.create({ name, email, password });
  logger.info(`New user registered id=${user._id}`);
  return buildSession(user, meta);
}

async function login({ email, password }, meta = {}) {
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH).catch(() => {});
    throw new AppError('Invalid email or password.', 401, null, 'AUTHENTICATION_ERROR');
  }

  if (user.lockUntil && user.lockUntil > new Date()) {
    throw new AppError(
      'Too many failed attempts. Please try again in a few minutes or reset your password.',
      429,
      null,
      'RATE_LIMITED'
    );
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= MAX_FAILED) {
      user.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
      user.failedLoginAttempts = 0;
      logger.warn(`Account locked after repeated failures id=${user._id}`);
    }
    await user.save();
    throw new AppError('Invalid email or password.', 401, null, 'AUTHENTICATION_ERROR');
  }

  if (!user.isActive) {
    throw new AppError('This account has been deactivated.', 403, null, 'AUTHORIZATION_ERROR');
  }

  if (user.failedLoginAttempts || user.lockUntil) {
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();
  }

  logger.info(`User logged in id=${user._id}`);
  return buildSession(user, meta);
}

async function refresh(rawRefreshToken, meta = {}) {
  const { userId, refreshToken } = await tokenService.rotateRefreshToken(rawRefreshToken, meta);
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    await tokenService.revokeAllForUser(userId);
    throw new AppError('Session is no longer valid. Please sign in again.', 401, null, 'AUTHENTICATION_ERROR');
  }
  return {
    user,
    token: tokenService.signAccessToken(user),
    refreshToken,
    expiresIn: tokenService.accessTokenTtlSeconds(),
  };
}

async function logout(rawRefreshToken, { allDevicesForUserId } = {}) {
  if (allDevicesForUserId) await tokenService.revokeAllForUser(allDevicesForUserId);
  else await tokenService.revokeRefreshToken(rawRefreshToken);
}

async function getCurrentUser(userId) {
  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found.', 404, null, 'NOT_FOUND');
  return user;
}

async function updateProfile(userId, updates) {
  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found.', 404, null, 'NOT_FOUND');

  if (updates.name !== undefined) user.name = updates.name;
  if (updates.phone !== undefined) user.phone = updates.phone || null;
  if (updates.preferences) {
    if (updates.preferences.language !== undefined) user.preferences.language = updates.preferences.language;
    if (updates.preferences.notifications) {
      Object.assign(user.preferences.notifications, updates.preferences.notifications);
    }
  }
  if (updates.healthPreferences) {
    Object.assign(user.healthPreferences, updates.healthPreferences);
  }
  await user.save();
  return user;
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+password');
  if (!user) throw new AppError('User not found.', 404, null, 'NOT_FOUND');
  if (!(await user.comparePassword(currentPassword))) {
    throw new AppError('Current password is incorrect.', 401, null, 'AUTHENTICATION_ERROR');
  }
  assertStrongPassword(newPassword, { email: user.email, name: user.name });
  user.password = newPassword;
  user.passwordChangedAt = new Date();
  await user.save();
  await tokenService.revokeAllForUser(user._id);
  return buildSession(user);
}

/**
 * Always resolves the same way to avoid account enumeration.
 * If e-mail delivery is not configured, the token is NOT returned or logged
 * in production; in development the link is logged at debug level only.
 */
async function forgotPassword(email) {
  const user = await User.findOne({ email: email.toLowerCase().trim(), isActive: true });
  if (!user) return { emailConfigured: isEmailConfigured() };

  const raw = tokenService.newOpaqueToken();
  await PasswordReset.updateMany({ user: user._id, usedAt: null }, { usedAt: new Date() });
  await PasswordReset.create({
    user: user._id,
    tokenHash: tokenService.sha256(raw),
    expiresAt: new Date(Date.now() + config.auth.resetTokenMinutes * 60 * 1000),
  });

  const link = `${config.appUrl}/?reset=${encodeURIComponent(raw)}`;

  if (!isEmailConfigured()) {
    logger.warn('Password reset requested but no e-mail provider is configured; no e-mail was sent.');
    if (!config.isProduction) logger.debug(`[dev only] password reset link: ${link}`);
    return { emailConfigured: false };
  }

  const result = await sendEmail({
    to: user.email,
    subject: 'Reset your SakhiAI password',
    text: `Hi ${user.name},\n\nUse this link to reset your SakhiAI password. It expires in ${config.auth.resetTokenMinutes} minutes and can be used once:\n${link}\n\nIf you did not request this, you can ignore this e-mail.`,
    html: `<p>Hi ${String(user.name).replace(/[<>&"]/g, '')},</p><p><a href="${link}">Reset your SakhiAI password</a>. The link expires in ${config.auth.resetTokenMinutes} minutes and can be used once.</p><p>If you did not request this, you can ignore this e-mail.</p>`,
  });
  if (!result.ok) logger.warn('Password reset e-mail could not be sent.');
  return { emailConfigured: true };
}

async function resetPassword({ token, newPassword }) {
  const record = await PasswordReset.findOne({ tokenHash: tokenService.sha256(token) });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new AppError('This reset link is invalid or has expired.', 400, null, 'VALIDATION_ERROR');
  }

  const user = await User.findById(record.user).select('+password');
  if (!user || !user.isActive) {
    throw new AppError('This reset link is invalid or has expired.', 400, null, 'VALIDATION_ERROR');
  }

  assertStrongPassword(newPassword, { email: user.email, name: user.name });

  user.password = newPassword;
  user.passwordChangedAt = new Date();
  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  await user.save();

  record.usedAt = new Date();
  await record.save();
  await tokenService.revokeAllForUser(user._id);
  logger.info(`Password reset completed id=${user._id}`);
}

export default {
  register,
  login,
  refresh,
  logout,
  getCurrentUser,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
};
