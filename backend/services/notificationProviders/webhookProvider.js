/**
 * services/notificationProviders/webhookProvider.js
 *
 * FREE channel: POSTs the alert as JSON to operator-configured webhook URLs
 * (NOTIFY_WEBHOOK_URLS). Works with ntfy.sh, Discord/Slack incoming webhooks,
 * Make/Zapier/n8n, a Telegram-bot relay, etc.
 *
 * Security: URLs come ONLY from server environment variables (never from
 * user input), which removes server-side-request-forgery risk. If
 * NOTIFY_WEBHOOK_SECRET is set, each request carries an HMAC-SHA256
 * signature in `X-SakhiAI-Signature`.
 *
 * Honesty: a 2xx response means the webhook endpoint ACCEPTED the alert.
 * It does not prove a human has read it — result status is "SENT" with that
 * wording in `detail`.
 */

import { createHmac } from 'node:crypto';
import config from '../../config/index.js';

const cfg = () => config.notifications.webhook;

function isAllowedUrl(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || (!config.isProduction && u.protocol === 'http:');
  } catch {
    return false;
  }
}

export default {
  name: 'webhook',
  channel: 'webhook',
  /** Alert-level channel: not tied to an individual contact. */
  perContact: false,

  isConfigured() {
    return cfg().urls.some(isAllowedUrl);
  },

  async send({ alert }) {
    const urls = cfg().urls.filter(isAllowedUrl);
    const body = JSON.stringify({
      event: alert.type,
      title: alert.title,
      text: alert.text,
      // Discord / Slack friendly field aliases
      content: alert.text,
      message: alert.text,
      user: alert.userName,
      location: alert.locationUrl,
      latitude: alert.latitude,
      longitude: alert.longitude,
      accuracyMeters: alert.accuracy,
      triggeredAt: alert.triggeredAt,
      eventId: alert.eventId,
    });

    const headers = { 'Content-Type': 'application/json', Title: alert.title, Priority: 'urgent', Tags: 'rotating_light' };
    if (cfg().secret) {
      headers['X-SakhiAI-Signature'] = createHmac('sha256', cfg().secret).update(body).digest('hex');
    }

    let accepted = 0;
    const failures = [];

    for (const url of urls) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), cfg().timeoutMs);
      try {
        const response = await fetch(url, { method: 'POST', headers, body, signal: controller.signal });
        if (response.ok) accepted += 1;
        else failures.push(`HTTP ${response.status}`);
      } catch (err) {
        failures.push(err.name === 'AbortError' ? 'timeout' : 'network error');
      } finally {
        clearTimeout(timer);
      }
    }

    if (accepted > 0) {
      return {
        status: 'SENT',
        detail: `Accepted by ${accepted}/${urls.length} webhook endpoint(s). This confirms the endpoint received the alert, not that a person has read it.`,
      };
    }
    return { status: 'FAILED', detail: `Webhook delivery failed (${failures.join(', ') || 'unknown'}).` };
  },
};
