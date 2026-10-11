/**
 * services/notificationProviders/webPushProvider.js
 *
 * FREE channel: standards-based Web Push (VAPID). No third-party account is
 * needed beyond generating a VAPID key pair (`npx web-push generate-vapid-keys`).
 *
 * Recipients for a contact:
 *   - every push subscription belonging to the SAME user (their other devices)
 *     — pushed once per alert, as a self-notification;
 *   - every subscription of a registered SakhiAI user whose account e-mail
 *     equals the contact's e-mail (the contact installed SakhiAI and enabled
 *     notifications).
 * A contact with no matching subscription is reported as NO_RECIPIENT — never
 * as notified.
 *
 * Honesty: "SENT" = the browser vendor's push service accepted the message
 * (HTTP 201). It does not prove the device displayed it. Expired
 * subscriptions (404/410) are removed.
 */

import webpush from 'web-push';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import PushSubscription from '../../models/PushSubscription.js';
import User from '../../models/User.js';

const cfg = () => config.notifications.webPush;
let vapidReady = false;

function ensureVapid() {
  if (vapidReady) return true;
  const { publicKey, privateKey, subject } = cfg();
  if (!publicKey || !privateKey || !subject) return false;
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidReady = true;
    return true;
  } catch (err) {
    logger.error(`Invalid VAPID configuration: ${err.message}`);
    return false;
  }
}

/** Test hook. */
export function _resetVapid() {
  vapidReady = false;
}

async function pushTo(subscriptions, payload) {
  let accepted = 0;
  let failed = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
        payload,
        { TTL: 3600, urgency: 'high', timeout: config.notifications.webhook.timeoutMs }
      );
      accepted += 1;
    } catch (err) {
      failed += 1;
      if (err.statusCode === 404 || err.statusCode === 410) {
        await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
      } else {
        logger.warn(`Web Push failed: status=${err.statusCode || 'n/a'}`);
      }
    }
  }
  return { accepted, failed };
}

export default {
  name: 'webpush',
  channel: 'webpush',
  perContact: true,

  isConfigured() {
    const { publicKey, privateKey, subject } = cfg();
    return Boolean(publicKey && privateKey && subject);
  },

  async canReach(contact, { userId }) {
    const targets = await this.resolveSubscriptions(contact, userId);
    return targets.length > 0;
  },

  async resolveSubscriptions(contact, userId) {
    const userIds = new Set([String(userId)]);
    if (contact?.email) {
      const match = await User.findOne({ email: contact.email.toLowerCase(), isActive: true }).select('_id');
      if (match) userIds.add(String(match._id));
    }
    return PushSubscription.find({ user: { $in: [...userIds] } });
  },

  async send({ contact, alert, userId }) {
    if (!ensureVapid()) return { status: 'NOT_CONFIGURED', detail: 'Web Push (VAPID) keys are not configured.' };

    const subscriptions = await this.resolveSubscriptions(contact, userId);
    if (subscriptions.length === 0) {
      return { status: 'NO_RECIPIENT', detail: 'This contact has no Web Push subscription.' };
    }

    const payload = JSON.stringify({
      title: alert.title,
      body: alert.shortText,
      url: alert.locationUrl || config.appUrl,
      tag: `sakhiai-${alert.type}-${alert.eventId || 'alert'}`,
      urgent: true,
    });

    const { accepted, failed } = await pushTo(subscriptions, payload);
    if (accepted > 0) {
      return {
        status: 'SENT',
        detail: `Accepted by the push service for ${accepted} device(s)${failed ? `, ${failed} failed` : ''}. Display on the device cannot be confirmed.`,
      };
    }
    return { status: 'FAILED', detail: 'Push service rejected or could not deliver the notification.' };
  },
};
