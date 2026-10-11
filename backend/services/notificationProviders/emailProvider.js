/**
 * services/notificationProviders/emailProvider.js
 *
 * FREE-TIER channel: e-mail to trusted contacts who have an e-mail address.
 * Two interchangeable transports, chosen by configuration:
 *   1. Resend HTTPS API   (RESEND_API_KEY + EMAIL_FROM)   – free tier
 *   2. Generic SMTP       (SMTP_HOST/PORT/USER/PASS)      – Gmail app password,
 *                          Brevo, Mailjet, etc. (free tiers)
 * Resend wins if both are configured.
 *
 * Also exports `sendEmail()` which the password-reset flow reuses.
 *
 * Honesty: "SENT" means the mail provider accepted the message for delivery.
 * Inbox delivery cannot be confirmed and the wording says so.
 */

import nodemailer from 'nodemailer';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

const cfg = () => config.notifications;

function transport() {
  if (cfg().resend.apiKey && cfg().resend.from) return 'resend';
  if (cfg().smtp.host && cfg().smtp.from) return 'smtp';
  return null;
}

let smtpTransporter = null;
function getSmtp() {
  if (!smtpTransporter) {
    const { host, port, secure, user, pass } = cfg().smtp;
    smtpTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
    });
  }
  return smtpTransporter;
}

/** Test hook: lets unit tests reset the cached transporter. */
export function _resetEmailTransport() {
  smtpTransporter = null;
}

export function isEmailConfigured() {
  return transport() !== null;
}

/**
 * Sends one e-mail. Returns { ok, detail }. Never throws.
 */
export async function sendEmail({ to, subject, text, html }) {
  const kind = transport();
  if (!kind) return { ok: false, notConfigured: true, detail: 'No e-mail provider configured.' };

  try {
    if (kind === 'resend') {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.notifications.webhook.timeoutMs);
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${cfg().resend.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: cfg().resend.from, to: [to], subject, text, html }),
          signal: controller.signal,
        });
        if (!response.ok) {
          logger.warn(`Resend rejected e-mail: HTTP ${response.status}`);
          return { ok: false, detail: `E-mail provider rejected the message (HTTP ${response.status}).` };
        }
        return { ok: true, detail: 'Accepted by e-mail provider.' };
      } finally {
        clearTimeout(timer);
      }
    }

    await getSmtp().sendMail({ from: cfg().smtp.from, to, subject, text, html });
    return { ok: true, detail: 'Accepted by SMTP server.' };
  } catch (err) {
    logger.warn(`E-mail send failed (${kind}): ${err.name === 'AbortError' ? 'timeout' : err.message}`);
    return { ok: false, detail: 'E-mail could not be sent.' };
  }
}

export default {
  name: 'email',
  channel: 'email',
  perContact: true,

  isConfigured: isEmailConfigured,

  /** A contact is reachable by e-mail only if an address is on file. */
  canReach(contact) {
    return Boolean(contact?.email);
  },

  async send({ contact, alert }) {
    const result = await sendEmail({
      to: contact.email,
      subject: alert.title,
      text: alert.text,
      html: alert.html,
    });
    return result.ok
      ? {
          status: 'SENT',
          detail: 'Handed to the e-mail provider. Inbox delivery cannot be confirmed.',
        }
      : { status: 'FAILED', detail: result.detail };
  },
};
