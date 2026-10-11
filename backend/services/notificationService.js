/**
 * services/notificationService.js
 *
 * Provider-independent notification dispatcher used by SOS, missed
 * check-ins and the "send test alert" feature.
 *
 * SOS business logic never talks to a specific channel. It calls
 * `dispatchAlert()`, which fans the alert out to every registered provider.
 * To add a provider later (Telegram bot, Pushover, SMS gateway, ...) create
 * a file in services/notificationProviders/ that implements:
 *
 *   {
 *     name, channel,
 *     perContact: boolean,        // true → called once per contact
 *     isConfigured(): boolean,
 *     canReach?(contact, ctx): boolean|Promise<boolean>,
 *     send({ contact, alert, userId }): Promise<{ status, detail }>
 *   }
 *
 * and add it to PROVIDERS below. Nothing else changes.
 *
 * ── Honest status model ───────────────────────────────────────────────
 *   SENT            provider ACCEPTED the message (webhook 2xx, e-mail API
 *                   accepted, push service 201). Delivery to a human is NOT
 *                   guaranteed and is never claimed.
 *   FAILED          provider is configured but the attempt failed.
 *   NOT_CONFIGURED  no provider is configured for this deployment.
 *   NO_RECIPIENT    provider works, but this contact has no address for it
 *                   (e.g. no e-mail, no push subscription).
 *   PENDING         recorded but not yet attempted.
 *
 * Overall status (summary.overall):
 *   SENT            ≥1 attempt was accepted
 *   FAILED          ≥1 provider configured, attempts made, none accepted
 *   NO_RECIPIENT    providers configured but nobody could be reached
 *   NO_CONTACTS     the user has no trusted contacts
 *   NOT_CONFIGURED  no notification provider is configured at all
 */

import config from '../config/index.js';
import logger from '../utils/logger.js';
import webhookProvider from './notificationProviders/webhookProvider.js';
import emailProvider from './notificationProviders/emailProvider.js';
import webPushProvider from './notificationProviders/webPushProvider.js';

export const NOTIFICATION_STATUS = Object.freeze({
  SENT: 'SENT',
  FAILED: 'FAILED',
  PENDING: 'PENDING',
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  NO_RECIPIENT: 'NO_RECIPIENT',
  NO_CONTACTS: 'NO_CONTACTS',
});

// Registry. Order = attempt order.
const PROVIDERS = [webPushProvider, emailProvider, webhookProvider];

const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Builds the channel-neutral alert content.
 * @param {'sos'|'sos_resolved'|'checkin_missed'|'test'} type
 */
export function buildAlert({ type, userName, latitude, longitude, accuracy, locationUrl, message, eventId, triggeredAt, delayedMinutes = 0 }) {
  const name = userName || 'A SakhiAI user';
  const when = new Date(triggeredAt || Date.now()).toISOString();
  const hasLocation = typeof latitude === 'number' && typeof longitude === 'number';
  const where = hasLocation
    ? `Location: ${locationUrl}${accuracy ? ` (accuracy ≈ ${Math.round(accuracy)} m)` : ''}`
    : 'Location was not available.';

  const copy = {
    sos: {
      title: `🚨 SOS from ${name}`,
      lead: `${name} triggered an SOS in SakhiAI and may need help.`,
    },
    sos_resolved: {
      title: `✅ ${name} marked themselves safe`,
      lead: `${name} has marked their earlier SOS as resolved.`,
    },
    checkin_missed: {
      title: `⚠️ ${name} missed a safety check-in`,
      lead: `${name} did not confirm a safety check-in in time.`,
    },
    test: {
      title: `🔔 Test alert from ${name}`,
      lead: `This is a TEST alert from ${name}. No emergency is happening.`,
    },
  }[type] || { title: 'SakhiAI alert', lead: 'SakhiAI alert.' };

  const lateNote =
    delayedMinutes >= 2
      ? `\nNOTE: this alert was created ${Math.round(delayedMinutes)} minutes ago while the phone had no internet and is only being sent now.`
      : '';
  const customMessage = (message ? `\nMessage: ${message}` : '') + lateNote;
  const text = `${copy.lead}\n${type === 'sos' || type === 'checkin_missed' ? where : ''}${customMessage}\nTime: ${when}\n\nPlease try to contact them. If you believe they are in danger, call your local emergency number (India: 112).\n— Sent via SakhiAI`;

  const html =
    `<p>${escapeHtml(copy.lead)}</p>` +
    (type === 'sos' || type === 'checkin_missed'
      ? hasLocation
        ? `<p>📍 <a href="${escapeHtml(locationUrl)}">Open location in Google Maps</a>${accuracy ? ` (accuracy ≈ ${Math.round(accuracy)} m)` : ''}</p>`
        : '<p>Location was not available.</p>'
      : '') +
    (message ? `<p>Message: ${escapeHtml(message)}</p>` : '') +
    (delayedMinutes >= 2 ? `<p><b>Note:</b> created ${Math.round(delayedMinutes)} minutes ago while the phone was offline; sent late.</p>` : '') +
    `<p>Time: ${escapeHtml(when)}</p>` +
    '<p>Please try to contact them. If you believe they are in danger, call your local emergency number (India: 112).</p>' +
    '<p><small>Sent via SakhiAI</small></p>';

  return {
    type,
    title: copy.title,
    text,
    html,
    shortText: `${copy.lead}${hasLocation && type !== 'test' ? ' Tap to open location.' : ''}`,
    userName: name,
    latitude: hasLocation ? latitude : null,
    longitude: hasLocation ? longitude : null,
    accuracy: accuracy ?? null,
    locationUrl: hasLocation ? locationUrl : null,
    eventId: eventId ? String(eventId) : null,
    triggeredAt: when,
  };
}

/** Which channels are configured? (booleans only — never secrets) */
export function getChannelStatus() {
  return {
    webpush: webPushProvider.isConfigured(),
    email: emailProvider.isConfigured(),
    webhook: webhookProvider.isConfigured(),
    anyConfigured: PROVIDERS.some((p) => p.isConfigured()),
    vapidPublicKey: webPushProvider.isConfigured() ? config.notifications.webPush.publicKey : null,
  };
}

async function safeSend(provider, args) {
  try {
    const result = await provider.send(args);
    return {
      status: result?.status || NOTIFICATION_STATUS.FAILED,
      detail: result?.detail || null,
    };
  } catch (err) {
    logger.error(`Notification provider "${provider.name}" threw: ${err.message}`);
    return { status: NOTIFICATION_STATUS.FAILED, detail: 'Provider error.' };
  }
}

/**
 * Sends an alert through every configured provider.
 *
 * @param {Object} params
 * @param {string} params.userId   - owner of the alert
 * @param {Array}  params.contacts - EmergencyContact documents / plain objects
 * @param {Object} params.alert    - from buildAlert()
 * @returns {Promise<{ results: Array, summary: { overall: string, sent: number, failed: number, configuredChannels: string[] } }>}
 */
export async function dispatchAlert({ userId, contacts = [], alert, skip = new Set() }) {
  const configured = PROVIDERS.filter((p) => p.isConfigured());
  const results = [];

  if (configured.length === 0) {
    logger.warn('Alert not delivered: no notification provider is configured (NOT_CONFIGURED).');
    return {
      results: [
        {
          provider: null,
          channel: null,
          contactId: null,
          contactName: null,
          status: NOTIFICATION_STATUS.NOT_CONFIGURED,
          detail: 'No notification provider is configured on this server. No contact was notified.',
          at: new Date(),
        },
      ],
      summary: { overall: NOTIFICATION_STATUS.NOT_CONFIGURED, sent: 0, failed: 0, configuredChannels: [] },
    };
  }

  // Alert-level providers (webhook): once per alert.
  for (const provider of configured.filter((p) => !p.perContact)) {
    if (skip.has(`${provider.name}:-`)) continue;
    const outcome = await safeSend(provider, { alert, userId, contacts });
    results.push({
      provider: provider.name,
      channel: provider.channel,
      contactId: null,
      contactName: null,
      ...outcome,
      at: new Date(),
    });
  }

  // Per-contact providers.
  for (const contact of contacts) {
    for (const provider of configured.filter((p) => p.perContact)) {
      if (skip.has(`${provider.name}:${contact._id || contact.id}`)) continue;
      let reachable = true;
      if (typeof provider.canReach === 'function') {
        try {
          reachable = await provider.canReach(contact, { userId });
        } catch {
          reachable = false;
        }
      }

      const base = {
        provider: provider.name,
        channel: provider.channel,
        contactId: contact._id || contact.id || null,
        contactName: contact.name || null,
        at: new Date(),
      };

      if (!reachable) {
        results.push({
          ...base,
          status: NOTIFICATION_STATUS.NO_RECIPIENT,
          detail: `No ${provider.channel} address/subscription on file for this contact.`,
        });
        continue;
      }

      const outcome = await safeSend(provider, { contact, alert, userId });
      results.push({ ...base, ...outcome, at: new Date() });
    }
  }

  const sent = results.filter((r) => r.status === NOTIFICATION_STATUS.SENT).length;
  const failed = results.filter((r) => r.status === NOTIFICATION_STATUS.FAILED).length;
  const attempted = results.filter((r) => r.status !== NOTIFICATION_STATUS.NO_RECIPIENT).length;

  let overall;
  if (sent > 0) overall = NOTIFICATION_STATUS.SENT;
  else if (contacts.length === 0 && configured.every((p) => p.perContact)) overall = NOTIFICATION_STATUS.NO_CONTACTS;
  else if (attempted === 0) overall = NOTIFICATION_STATUS.NO_RECIPIENT;
  else overall = NOTIFICATION_STATUS.FAILED;

  logger.info(`Alert dispatch finished type=${alert.type} overall=${overall} sent=${sent} failed=${failed}`);

  return {
    results,
    summary: { overall, sent, failed, configuredChannels: configured.map((p) => p.channel) },
  };
}

export default { dispatchAlert, buildAlert, getChannelStatus, NOTIFICATION_STATUS };
