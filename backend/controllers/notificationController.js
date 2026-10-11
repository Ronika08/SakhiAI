/**
 * controllers/notificationController.js
 *
 * Notification channel status, Web Push subscription management and a
 * "send test alert" action so users can verify their setup honestly BEFORE
 * an emergency.
 */

import { AppError } from '../middleware/errorHandler.js';
import PushSubscription from '../models/PushSubscription.js';
import EmergencyContact from '../models/EmergencyContact.js';
import User from '../models/User.js';
import notificationService, { getChannelStatus } from '../services/notificationService.js';

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/** GET /api/notifications/status – which channels exist (booleans only). */
export const getStatus = asyncHandler(async (req, res) => {
  const status = getChannelStatus();
  res.status(200).json({
    success: true,
    data: {
      channels: { webpush: status.webpush, email: status.email, webhook: status.webhook },
      anyConfigured: status.anyConfigured,
      vapidPublicKey: status.vapidPublicKey,
    },
  });
});

/** POST /api/notifications/push/subscribe  Body: { subscription: PushSubscriptionJSON } */
export const subscribePush = asyncHandler(async (req, res) => {
  const sub = req.body?.subscription;
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;

  if (typeof endpoint !== 'string' || !/^https:\/\//.test(endpoint) || endpoint.length > 1000) {
    throw new AppError('A valid push subscription endpoint (https) is required.', 400);
  }
  if (typeof p256dh !== 'string' || typeof auth !== 'string') {
    throw new AppError('Push subscription keys are required.', 400);
  }

  await PushSubscription.findOneAndUpdate(
    { endpoint },
    { user: req.user.id, endpoint, keys: { p256dh, auth }, userAgent: (req.headers['user-agent'] || '').slice(0, 300) },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.status(201).json({ success: true, data: { subscribed: true } });
});

/** DELETE /api/notifications/push/subscribe  Body: { endpoint } */
export const unsubscribePush = asyncHandler(async (req, res) => {
  const { endpoint } = req.body || {};
  if (typeof endpoint !== 'string') throw new AppError('Field "endpoint" is required.', 400);
  await PushSubscription.deleteOne({ endpoint, user: req.user.id });
  res.status(200).json({ success: true, data: { subscribed: false } });
});

/**
 * POST /api/notifications/test
 * Sends a clearly-labelled TEST alert to the user's SOS contacts through every
 * configured channel and returns per-attempt results.
 */
export const sendTest = asyncHandler(async (req, res) => {
  const [user, contacts] = await Promise.all([
    User.findById(req.user.id).select('name'),
    EmergencyContact.find({ user: req.user.id, 'notifyOn.sos': true }),
  ]);

  const alert = notificationService.buildAlert({ type: 'test', userName: user?.name });
  const { results, summary } = await notificationService.dispatchAlert({
    userId: req.user.id,
    contacts,
    alert,
  });

  res.status(200).json({ success: true, data: { summary, results } });
});

export default { getStatus, subscribePush, unsubscribePush, sendTest };
