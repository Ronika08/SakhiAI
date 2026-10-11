/**
 * components/SOSStatus.jsx
 *
 * Honest SOS outcome panel. It only ever states what actually happened:
 *  - anonymous users: the SMS/WhatsApp apps were OPENED; nothing is sent
 *    until the user presses Send in those apps.
 *  - signed-in users: the backend result (SENT / FAILED / NOT_CONFIGURED /
 *    NO_RECIPIENT / NO_CONTACTS) with per-channel details. "SENT" means a
 *    provider accepted the alert — never that a person has read it.
 */
const STATUS_STYLE = {
  SENT: { bg: "#fff8e1", border: "#ffe082", fg: "#7a5200", icon: "📤", title: "Alert accepted by the notification service (delivery not confirmed)" },
  FAILED: { bg: "#ffebee", border: "#ef9a9a", fg: "#b71c1c", icon: "⚠️", title: "Alert could not be sent" },
  NO_RECIPIENT: { bg: "#ffebee", border: "#ef9a9a", fg: "#b71c1c", icon: "⚠️", title: "No contact could be reached" },
  NO_CONTACTS: { bg: "#ffebee", border: "#ef9a9a", fg: "#b71c1c", icon: "⚠️", title: "No contacts to alert" },
  NOT_CONFIGURED: { bg: "#ffebee", border: "#ef9a9a", fg: "#b71c1c", icon: "⚠️", title: "No contact was notified automatically" },
  PENDING: { bg: "#e3f2fd", border: "#90caf9", fg: "#0d47a1", icon: "⏳", title: "Sending alert…" },
};

const RESULT_LABEL = {
  SENT: "accepted by service",
  FAILED: "failed",
  NO_RECIPIENT: "no address/subscription",
  NOT_CONFIGURED: "not set up",
  PENDING: "pending",
};

import { useLanguage } from "../i18n/LanguageContext";

export default function SOSStatus({ report, isAuthenticated, onRetry, onResolve, onDismiss, resolving }) {
  const { t } = useLanguage();
  if (!report) return null;

  if (report.phase === "local") {
    const s = STATUS_STYLE.NOT_CONFIGURED;
    return (
      <div role="alert" style={panel(s)}>
        <div style={{ fontWeight: "bold" }}>{s.icon} {t("sos.local.title")}</div>
        <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>{t("sos.local.body")}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <a href="tel:112" style={{ ...btn("#e65100"), textDecoration: "none", textAlign: "center" }}>{t("sos.call112")}</a>
          <button onClick={onDismiss} style={btn("#757575")}>{t("common.dismiss")}</button>
        </div>
      </div>
    );
  }

  if (report.phase === "queued") {
    const s = STATUS_STYLE.PENDING;
    return (
      <div role="alert" style={panel(s)}>
        <div style={{ fontWeight: "bold" }}>{s.icon} {t("sos.queued.title")} · {t(report.retrying ? "status.RETRYING" : "status.PENDING")}</div>
        <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>{t("sos.queued.body")}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <a href="tel:112" style={{ ...btn("#e65100"), textDecoration: "none", textAlign: "center" }}>{t("sos.call112")}</a>
          <button onClick={onRetry} style={btn("#c62828")}>{t("sos.retry")}</button>
          <button onClick={() => onResolve?.(false)} style={btn("#2e7d32")}>{t("sos.safe")}</button>
        </div>
      </div>
    );
  }

  if (report.phase === "sending") {
    const s = STATUS_STYLE.PENDING;
    return (
      <div role="status" aria-live="polite" style={panel(s)}>
        <div style={{ fontWeight: "bold" }}>{s.icon} {s.title}</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>Getting your location and contacting the server. Keep this screen open.</div>
      </div>
    );
  }

  if (report.phase === "error") {
    const s = STATUS_STYLE.FAILED;
    return (
      <div role="alert" style={panel(s)}>
        <div style={{ fontWeight: "bold" }}>{s.icon} The server alert was NOT sent</div>
        <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>
          {report.message} Your SMS/WhatsApp apps were still opened — tap Send there, or call 112 now. The alert is kept on this device and will be retried.
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button onClick={onRetry} style={btn("#c62828")}>{t("sos.retry")}</button>
          <a href="tel:112" style={{ ...btn("#e65100"), textDecoration: "none", textAlign: "center" }}>{t("sos.call112")}</a>
        </div>
      </div>
    );
  }

  if (report.phase === "resolved") {
    return (
      <div role="status" style={panel({ bg: "#e8f5e9", border: "#a5d6a7", fg: "#1b5e20" })}>
        <div style={{ fontWeight: "bold" }}>✅ Marked as safe</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>{report.message}</div>
        <button onClick={onDismiss} style={{ ...btn("#2e7d32"), marginTop: 10 }}>Dismiss</button>
      </div>
    );
  }

  // phase === "done" (signed-in, backend answered)
  const status = report.delivery?.notificationStatus || "FAILED";
  const s = STATUS_STYLE[status] || STATUS_STYLE.FAILED;
  const attempts = (report.event?.notifications || []).filter((n) => n.channel);

  return (
    <div role="alert" style={panel(s)}>
      <div style={{ fontWeight: "bold", fontSize: 15 }}>{s.icon} {s.title}</div>
      <div style={{ fontSize: 13, marginTop: 6, lineHeight: 1.55 }}>{report.delivery?.notificationMessage}</div>

      {report.locationNote && <div style={{ fontSize: 12, marginTop: 6 }}>📍 {report.locationNote}</div>}

      {attempts.length > 0 && (
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12, lineHeight: 1.6 }}>
          {attempts.map((n, i) => (
            <li key={i}>{n.contactName ? `${n.contactName} — ` : ""}{n.channel}: {RESULT_LABEL[n.status] || n.status}</li>
          ))}
        </ul>
      )}

      {!isAuthenticated && null}

      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <a href="tel:112" style={{ ...btn("#e65100"), textDecoration: "none", textAlign: "center" }}>{t("sos.call112")}</a>
        <button onClick={() => onResolve?.(status === "SENT")} disabled={resolving} style={{ ...btn("#2e7d32"), opacity: resolving ? 0.7 : 1 }}>
          {t("sos.safe")}{status === "SENT" ? " (+)" : ""}
        </button>
      </div>
    </div>
  );
}

const panel = (s) => ({ marginTop: 14, background: s.bg, borderRadius: 14, padding: "14px 16px", border: `1px solid ${s.border}`, color: s.fg, textAlign: "left" });
const btn = (bg) => ({ background: bg, color: "#fff", border: "none", borderRadius: 10, padding: "10px 14px", fontWeight: "bold", fontSize: 13, cursor: "pointer", flex: "1 1 auto", minHeight: 44 });
