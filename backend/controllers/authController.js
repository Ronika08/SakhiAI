/**
 * controllers/authController.js
 *
 * HTTP request/response layer for authentication. Validates input and
 * delegates all logic (hashing, tokens, DB) to services/authService.js.
 *
 * Backward compatible: register/login still return
 *   { success, data: { user, token } }
 * and now ALSO include `refreshToken` and `expiresIn` (seconds).
 */

import { AppError } from '../middleware/errorHandler.js';
import authService from '../services/authService.js';

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const meta = (req) => ({ userAgent: req.headers['user-agent'] });

const requireString = (value, field, { max = 200 } = {}) => {
  if (!value || typeof value !== 'string' || !value.trim()) {
    throw new AppError(`Field "${field}" is required.`, 400, null, 'VALIDATION_ERROR');
  }
  if (value.length > max) throw new AppError(`Field "${field}" is too long.`, 400, null, 'VALIDATION_ERROR');
  return value;
};

const requireEmail = (value) => {
  if (!value || typeof value !== 'string' || value.length > 254 || !EMAIL_REGEX.test(value.trim())) {
    throw new AppError('A valid "email" is required.', 400, null, 'VALIDATION_ERROR');
  }
  return value.trim();
};

const sessionBody = ({ user, token, refreshToken, expiresIn }) => ({
  success: true,
  data: { user, token, refreshToken, expiresIn },
});

/** POST /api/auth/register  Body: { name, email, password } */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  requireString(name, 'name', { max: 100 });
  requireEmail(email);
  requireString(password, 'password', { max: 128 });

  const session = await authService.register({ name: name.trim(), email: email.trim(), password }, meta(req));
  res.status(201).json(sessionBody(session));
});

/** POST /api/auth/login  Body: { email, password } */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  requireEmail(email);
  requireString(password, 'password', { max: 128 });

  const session = await authService.login({ email: email.trim(), password }, meta(req));
  res.status(200).json(sessionBody(session));
});

/** POST /api/auth/refresh  Body: { refreshToken } */
export const refresh = asyncHandler(async (req, res) => {
  requireString(req.body.refreshToken, 'refreshToken', { max: 200 });
  const session = await authService.refresh(req.body.refreshToken, meta(req));
  res.status(200).json(sessionBody(session));
});

/** POST /api/auth/logout  Body: { refreshToken?, allDevices? }  (requires access token when allDevices) */
export const logout = asyncHandler(async (req, res) => {
  const { refreshToken, allDevices } = req.body || {};
  await authService.logout(refreshToken, {
    allDevicesForUserId: allDevices === true && req.user ? req.user.id : undefined,
  });
  res.status(200).json({ success: true, data: { loggedOut: true } });
});

/** GET /api/auth/me */
export const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id);
  res.status(200).json({ success: true, data: { user } });
});

/** PATCH /api/auth/me  Body: { name?, phone?, preferences?, healthPreferences? } */
export const updateMe = asyncHandler(async (req, res) => {
  const { name, phone, preferences, healthPreferences } = req.body || {};
  const updates = {};

  if (name !== undefined) updates.name = requireString(name, 'name', { max: 100 }).trim();
  if (phone !== undefined) {
    if (phone !== null && phone !== '' && (typeof phone !== 'string' || !/^[+]?[\d\s()-]{7,20}$/.test(phone))) {
      throw new AppError('Field "phone" must be a valid phone number.', 400, null, 'VALIDATION_ERROR');
    }
    updates.phone = phone;
  }
  if (preferences !== undefined) {
    if (typeof preferences !== 'object' || preferences === null) {
      throw new AppError('Field "preferences" must be an object.', 400, null, 'VALIDATION_ERROR');
    }
    updates.preferences = {};
    if (preferences.language !== undefined) {
      if (typeof preferences.language !== 'string' || preferences.language.length > 10) {
        throw new AppError('Field "preferences.language" is invalid.', 400, null, 'VALIDATION_ERROR');
      }
      updates.preferences.language = preferences.language;
    }
    if (preferences.notifications) {
      const n = {};
      for (const k of ['reminders', 'sosAlerts']) {
        if (preferences.notifications[k] !== undefined) {
          if (typeof preferences.notifications[k] !== 'boolean') {
            throw new AppError(`Field "preferences.notifications.${k}" must be true or false.`, 400, null, 'VALIDATION_ERROR');
          }
          n[k] = preferences.notifications[k];
        }
      }
      updates.preferences.notifications = n;
    }
  }
  if (healthPreferences !== undefined) {
    const h = {};
    const ranges = { typicalCycleLengthDays: [15, 60], typicalPeriodLengthDays: [1, 14] };
    for (const [k, [lo, hi]] of Object.entries(ranges)) {
      const v = healthPreferences?.[k];
      if (v !== undefined) {
        if (!Number.isInteger(v) || v < lo || v > hi) {
          throw new AppError(`Field "healthPreferences.${k}" must be a whole number from ${lo} to ${hi}.`, 400, null, 'VALIDATION_ERROR');
        }
        h[k] = v;
      }
    }
    updates.healthPreferences = h;
  }

  const user = await authService.updateProfile(req.user.id, updates);
  res.status(200).json({ success: true, data: { user } });
});

/** POST /api/auth/change-password  Body: { currentPassword, newPassword } */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  requireString(currentPassword, 'currentPassword', { max: 128 });
  requireString(newPassword, 'newPassword', { max: 128 });
  const session = await authService.changePassword(req.user.id, { currentPassword, newPassword });
  res.status(200).json(sessionBody(session));
});

/** POST /api/auth/forgot-password  Body: { email } — always the same response. */
export const forgotPassword = asyncHandler(async (req, res) => {
  requireEmail(req.body?.email);
  await authService.forgotPassword(req.body.email.trim());
  res.status(200).json({
    success: true,
    data: { message: 'If an account exists for that e-mail, a reset link has been sent.' },
  });
});

/** POST /api/auth/reset-password  Body: { token, newPassword } */
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body || {};
  requireString(token, 'token', { max: 200 });
  requireString(newPassword, 'newPassword', { max: 128 });
  await authService.resetPassword({ token, newPassword });
  res.status(200).json({ success: true, data: { message: 'Password updated. Please sign in.' } });
});

export default {
  register,
  login,
  refresh,
  logout,
  getMe,
  updateMe,
  changePassword,
  forgotPassword,
  resetPassword,
};
