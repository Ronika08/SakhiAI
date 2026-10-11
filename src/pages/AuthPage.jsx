/**
 * pages/AuthPage.jsx
 *
 * Sign in / create account / forgot password / reset password in one
 * accessible screen. Signing in is OPTIONAL: it adds cloud sync and
 * server-side SOS alerts. All existing features keep working without it.
 */
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { notificationsApi } from "../services/dataApi";
import { enablePush, disablePush, pushSupported } from "../services/pwa";

const MODES = { login: "Sign in", register: "Create account", forgot: "Forgot password", reset: "Choose a new password" };

export default function AuthPage({ cardStyle, inputStyle, btnPrimary, setScreen, resetToken, onResetDone }) {
  const { login, register, forgotPassword, resetPassword, isAuthenticated, user, logout, sessionNotice } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState(resetToken ? "reset" : "login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const headingRef = useRef(null);

  useEffect(() => { headingRef.current?.focus(); }, [mode]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        await login({ email: form.email, password: form.password });
        toast.success("Signed in. Your data will now sync to your account.");
        setScreen("home");
      } else if (mode === "register") {
        await register({ name: form.name, email: form.email, password: form.password });
        toast.success("Account created. Your data will now sync.");
        setScreen("home");
      } else if (mode === "forgot") {
        await forgotPassword(form.email);
        toast.info("If an account exists for that e-mail, a reset link has been sent.");
        setMode("login");
      } else if (mode === "reset") {
        await resetPassword({ token: resetToken, newPassword: form.password });
        toast.success("Password updated. Please sign in.");
        onResetDone?.();
        setMode("login");
      }
    } catch (err) {
      setError(err.userMessage || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const [channels, setChannels] = useState(null);
  const [testResult, setTestResult] = useState(null);
  useEffect(() => {
    if (!isAuthenticated) return;
    notificationsApi.status().then(setChannels).catch(() => setChannels(null));
  }, [isAuthenticated]);

  async function runTest() {
    setBusy(true); setTestResult(null);
    try {
      const { summary, results } = await notificationsApi.sendTest();
      setTestResult({ summary, results });
    } catch (err) { toast.error(err.userMessage); } finally { setBusy(false); }
  }
  async function togglePush(on) {
    try {
      if (on) { await enablePush(); toast.success("Push notifications enabled on this device."); }
      else { await disablePush(); toast.info("Push notifications disabled on this device."); }
    } catch (err) { toast.error(err.message || "Couldn't change push settings."); }
  }

  if (isAuthenticated) {
    return (
      <div style={{ padding: 20, paddingBottom: 80 }}>
        <h1 ref={headingRef} tabIndex={-1} style={{ fontSize: 22, color: "#880e4f", margin: "0 0 4px" }}>👤 Your account</h1>
        <div style={cardStyle}>
          <p style={{ margin: "0 0 4px", fontWeight: "bold", color: "#880e4f" }}>{user?.name}</p>
          <p style={{ margin: "0 0 14px", color: "#666", fontSize: 14 }}>{user?.email}</p>
          <p style={{ margin: "0 0 14px", color: "#2e7d32", fontSize: 13 }}>✅ Cycle, wellness, mood, Trusted Circle and SOS history sync to your account.</p>
          <div style={{ borderTop: "1px solid #f3d3e2", paddingTop: 12, marginBottom: 14 }}>
            <p style={{ margin: "0 0 6px", fontWeight: "bold", color: "#880e4f", fontSize: 14 }}>🔔 SOS alert channels (this server)</p>
            {channels ? (
              <ul style={{ margin: "0 0 10px", paddingLeft: 18, fontSize: 13, color: "#444", lineHeight: 1.6 }}>
                <li>E-mail: {channels.channels.email ? "configured" : "not configured"}</li>
                <li>Web Push: {channels.channels.webpush ? "configured" : "not configured"}</li>
                <li>Webhook: {channels.channels.webhook ? "configured" : "not configured"}</li>
              </ul>
            ) : <p style={{ fontSize: 13, color: "#777" }}>Channel status unavailable right now.</p>}
            {channels && !channels.anyConfigured && (
              <p role="status" style={{ fontSize: 12, color: "#b71c1c", margin: "0 0 10px" }}>No channel is configured, so SOS will report “NOT_CONFIGURED” and will not notify anyone automatically.</p>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={runTest} disabled={busy} style={{ ...btnPrimary, width: "auto", flex: 1, padding: "10px 12px", fontSize: 13 }}>Send test alert</button>
              {pushSupported() && channels?.channels.webpush && (
                <>
                  <button onClick={() => togglePush(true)} style={{ ...btnPrimary, width: "auto", flex: 1, padding: "10px 12px", fontSize: 13, background: "#1565c0" }}>Enable push here</button>
                  <button onClick={() => togglePush(false)} style={{ ...btnPrimary, width: "auto", flex: 1, padding: "10px 12px", fontSize: 13, background: "#757575" }}>Disable push</button>
                </>
              )}
            </div>
            {testResult && (
              <div role="status" style={{ marginTop: 10, fontSize: 13, background: "#f5f5f5", borderRadius: 10, padding: 10 }}>
                <b>Test result: {testResult.summary.overall}</b>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {testResult.results.map((r, i) => <li key={i}>{r.contactName ? `${r.contactName} — ` : ""}{r.channel || "no channel"}: {r.status}{r.detail ? ` (${r.detail})` : ""}</li>)}
                </ul>
              </div>
            )}
          </div>
          <button onClick={async () => { await logout(); toast.info("Signed out. Your data stays on this device."); setScreen("home"); }} style={btnPrimary}>Sign out</button>
        </div>
      </div>
    );
  }

  const idPrefix = `auth-${mode}`;
  return (
    <div style={{ padding: 20, paddingBottom: 80 }}>
      <h1 ref={headingRef} tabIndex={-1} style={{ fontSize: 22, color: "#880e4f", margin: "0 0 4px" }}>🔐 {MODES[mode]}</h1>
      <p style={{ color: "#ad1457", fontSize: 13, margin: "0 0 16px" }}>
        Optional — sign in to sync your data and enable server-side SOS alerts. Everything also works without an account.
      </p>

      {sessionNotice && <div role="status" style={{ background: "#fff3e0", border: "1px solid #ffcc80", color: "#7a3d00", borderRadius: 12, padding: 10, fontSize: 13, marginBottom: 12 }}>{sessionNotice}</div>}

      <form onSubmit={submit} style={cardStyle} noValidate aria-describedby={error ? `${idPrefix}-error` : undefined}>
        {error && <div id={`${idPrefix}-error`} role="alert" style={{ background: "#ffebee", color: "#b71c1c", border: "1px solid #ef9a9a", borderRadius: 10, padding: 10, fontSize: 13, marginBottom: 12 }}>{error}</div>}

        {mode === "register" && (
          <>
            <label htmlFor={`${idPrefix}-name`} style={labelStyle}>Name</label>
            <input id={`${idPrefix}-name`} value={form.name} onChange={set("name")} autoComplete="name" required maxLength={100} style={inputStyle} />
          </>
        )}
        {mode !== "reset" && (
          <>
            <label htmlFor={`${idPrefix}-email`} style={labelStyle}>E-mail</label>
            <input id={`${idPrefix}-email`} type="email" value={form.email} onChange={set("email")} autoComplete="email" required inputMode="email" style={inputStyle} />
          </>
        )}
        {mode !== "forgot" && (
          <>
            <label htmlFor={`${idPrefix}-password`} style={labelStyle}>{mode === "reset" ? "New password" : "Password"}</label>
            <input id={`${idPrefix}-password`} type="password" value={form.password} onChange={set("password")} required
              autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "login" ? undefined : 8}
              aria-describedby={mode !== "login" ? `${idPrefix}-hint` : undefined} style={inputStyle} />
            {mode !== "login" && <p id={`${idPrefix}-hint`} style={{ margin: "-4px 0 12px", fontSize: 12, color: "#777" }}>At least 8 characters with a letter and a number.</p>}
          </>
        )}

        <button type="submit" disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.7 : 1 }}>
          {busy ? "Please wait…" : mode === "forgot" ? "Send reset link" : MODES[mode]}
        </button>
      </form>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", fontSize: 13 }}>
        {mode !== "login" && <button type="button" onClick={() => { setMode("login"); setError(""); }} style={linkBtn}>Sign in</button>}
        {mode !== "register" && mode !== "reset" && <button type="button" onClick={() => { setMode("register"); setError(""); }} style={linkBtn}>Create account</button>}
        {mode === "login" && <button type="button" onClick={() => { setMode("forgot"); setError(""); }} style={linkBtn}>Forgot password?</button>}
        <button type="button" onClick={() => setScreen("home")} style={linkBtn}>Continue without an account</button>
      </div>
    </div>
  );
}

const labelStyle = { display: "block", color: "#c2185b", fontWeight: "bold", marginBottom: 6, fontSize: 14 };
const linkBtn = { background: "none", border: "none", color: "#c2185b", textDecoration: "underline", cursor: "pointer", fontSize: 13, padding: 8, minHeight: 40 };
