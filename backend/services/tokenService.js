/**
 * services/tokenService.js
 *
 * Access-token signing and refresh-token lifecycle.
 *
 *  - Access token: short-lived JWT (JWT_ACCESS_EXPIRES_IN, default 15m),
 *    sent as `Authorization: Bearer`.
 *  - Refresh token: random 256-bit opaque string. Only its SHA-256 hash is
 *    stored. Rotated on every use; replaying an already-rotated token revokes
 *    the entire token family (suspected theft).
 */

import jwt from 'jsonwebtoken';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import config from '../config/index.js';
import RefreshToken from '../models/RefreshToken.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
export const newOpaqueToken = () => randomBytes(32).toString('base64url');

export function signAccessToken(user) {
  if (!config.auth.jwtSecret) {
    throw new AppError('Authentication is not available right now.', 503, null, 'AUTHENTICATION_ERROR');
  }
  return jwt.sign({ id: user._id.toString(), role: user.role || 'user' }, config.auth.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: config.auth.accessExpiresIn,
  });
}

/** Seconds until an access token issued now expires (for the client). */
export function accessTokenTtlSeconds() {
  const decoded = jwt.decode(
    jwt.sign({}, config.auth.jwtSecret || 'x', { expiresIn: config.auth.accessExpiresIn })
  );
  return decoded.exp - decoded.iat;
}

export async function issueRefreshToken(user, { userAgent, family } = {}) {
  const raw = newOpaqueToken();
  const expiresAt = new Date(Date.now() + config.auth.refreshExpiresDays * 24 * 60 * 60 * 1000);
  await RefreshToken.create({
    user: user._id,
    tokenHash: sha256(raw),
    family: family || randomUUID(),
    expiresAt,
    userAgent: (userAgent || '').slice(0, 300) || null,
  });
  return raw;
}

/**
 * Validates + rotates a refresh token. Returns { userId, refreshToken }.
 */
export async function rotateRefreshToken(rawToken, { userAgent } = {}) {
  if (typeof rawToken !== 'string' || rawToken.length < 20) {
    throw new AppError('Invalid refresh token.', 401, null, 'AUTHENTICATION_ERROR');
  }

  const record = await RefreshToken.findOne({ tokenHash: sha256(rawToken) });
  if (!record) throw new AppError('Invalid refresh token.', 401, null, 'AUTHENTICATION_ERROR');

  if (record.revokedAt) {
    // Reuse of a rotated/revoked token → revoke the whole family.
    await RefreshToken.updateMany({ family: record.family, revokedAt: null }, { revokedAt: new Date() });
    logger.warn(`Refresh token reuse detected for user ${record.user}; token family revoked.`);
    throw new AppError('Session is no longer valid. Please sign in again.', 401, null, 'AUTHENTICATION_ERROR');
  }
  if (record.expiresAt < new Date()) {
    throw new AppError('Session expired. Please sign in again.', 401, null, 'AUTHENTICATION_ERROR');
  }

  const next = newOpaqueToken();
  record.revokedAt = new Date();
  record.replacedByHash = sha256(next);
  await record.save();

  await RefreshToken.create({
    user: record.user,
    tokenHash: sha256(next),
    family: record.family,
    expiresAt: new Date(Date.now() + config.auth.refreshExpiresDays * 24 * 60 * 60 * 1000),
    userAgent: (userAgent || '').slice(0, 300) || null,
  });

  return { userId: record.user.toString(), refreshToken: next };
}

export async function revokeRefreshToken(rawToken) {
  if (typeof rawToken !== 'string' || !rawToken) return;
  await RefreshToken.updateOne({ tokenHash: sha256(rawToken), revokedAt: null }, { revokedAt: new Date() });
}

export async function revokeAllForUser(userId) {
  await RefreshToken.updateMany({ user: userId, revokedAt: null }, { revokedAt: new Date() });
}

export default {
  signAccessToken,
  accessTokenTtlSeconds,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
  sha256,
  newOpaqueToken,
};
