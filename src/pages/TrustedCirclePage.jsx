import { useState } from "react";

export default function TrustedCirclePage({
  cardStyle,
  sectionTitle,
  inputStyle,
  contacts,
  updateContact,
  RELATIONSHIP_OPTIONS,
  contactAlertMsg,
  saveContacts,
  isAuthenticated,
  syncState,
  setScreen,
}) {
  const [saving, setSaving] = useState(false);
  async function handleSave() {
    setSaving(true);
    try { await saveContacts?.(); } finally { setSaving(false); }
  }

  return (
    <div style={{ padding: 20, paddingBottom: 80 }}>
      <h1 style={{ fontWeight: "bold", fontSize: 22, color: "#880e4f", marginBottom: 4, marginTop: 0 }}>👥 Trusted Circle</h1>
      <div style={{ color: "#ad1457", fontSize: 13, marginBottom: 20 }}>Your 3 closest emergency contacts</div>

      {syncState?.loading && <div role="status" aria-busy="true" style={{ fontSize: 13, color: "#ad1457", marginBottom: 12 }}>Syncing your circle…</div>}

      {contacts.map((c, i) => (
        <fieldset key={i} style={{ ...cardStyle, border: "1px solid rgba(194,24,91,0.15)", margin: "0 0 16px" }}>
          <legend style={{ ...sectionTitle, marginBottom: 12, padding: "0 6px" }}>Contact {i + 1}{i === 0 ? " (primary)" : ""}</legend>
          <label htmlFor={`contact-name-${i}`} className="sr-only">Contact {i + 1} name</label>
          <input id={`contact-name-${i}`} value={c.name} placeholder={`Name (e.g. ${["Mom","Best Friend","Sister"][i] || "Contact"})`} autoComplete="off" maxLength={100}
            onChange={e => updateContact(i, "name", e.target.value)} style={inputStyle} />
          <label htmlFor={`contact-phone-${i}`} className="sr-only">Contact {i + 1} phone number</label>
          <input id={`contact-phone-${i}`} value={c.phone} placeholder="+91XXXXXXXXXX" type="tel" inputMode="tel" autoComplete="off"
            onChange={e => updateContact(i, "phone", e.target.value)} style={inputStyle} />
          <label htmlFor={`contact-email-${i}`} className="sr-only">Contact {i + 1} e-mail (optional, enables e-mail alerts)</label>
          <input id={`contact-email-${i}`} value={c.email || ""} placeholder="E-mail (optional — enables e-mail / push alerts)" type="email" inputMode="email" autoComplete="off"
            onChange={e => updateContact(i, "email", e.target.value)} style={inputStyle} />
          <label htmlFor={`contact-rel-${i}`} className="sr-only">Contact {i + 1} relationship</label>
          <select id={`contact-rel-${i}`} value={c.relationship} onChange={e => updateContact(i, "relationship", e.target.value)} style={{ ...inputStyle, marginBottom: 0 }}>
            {RELATIONSHIP_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          {c.phone && (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <a href={`sms:${c.phone}?body=${encodeURIComponent(contactAlertMsg())}`} style={{
                flex: 1, background: "linear-gradient(135deg,#1565c0,#1976d2)", color: "#fff",
                padding: "10px 0", borderRadius: 10, textAlign: "center", textDecoration: "none", fontWeight: "bold", fontSize: 13,
              }}>📱 SMS</a>
              <a href={`https://wa.me/${c.phone.replace(/\D/g,"")}?text=${encodeURIComponent(contactAlertMsg())}`} target="_blank" rel="noreferrer" style={{
                flex: 1, background: "linear-gradient(135deg,#1b5e20,#2e7d32)", color: "#fff",
                padding: "10px 0", borderRadius: 10, textAlign: "center", textDecoration: "none", fontWeight: "bold", fontSize: 13,
              }}>💬 WhatsApp</a>
              <a href={`tel:${c.phone}`} style={{
                flex: 1, background: "linear-gradient(135deg,#e65100,#f4511e)", color: "#fff",
                padding: "10px 0", borderRadius: 10, textAlign: "center", textDecoration: "none", fontWeight: "bold", fontSize: 13,
              }}>📞 Call</a>
            </div>
          )}
        </fieldset>
      ))}

      <button onClick={handleSave} disabled={saving} style={{
        width: "100%", background: "linear-gradient(135deg,#c2185b,#e91e63)", border: "none", borderRadius: 12,
        padding: "12px 20px", color: "#fff", fontWeight: "bold", fontSize: 14, cursor: "pointer", marginBottom: 14, opacity: saving ? 0.7 : 1, minHeight: 44,
      }}>{saving ? "Saving…" : isAuthenticated ? "💾 Save to my account" : "💾 Save on this device"}</button>

      <div style={{ background: isAuthenticated ? "#e8f5e9" : "#fff8e1", borderRadius: 14, padding: 14, border: `1px solid ${isAuthenticated ? "#a5d6a7" : "#ffe082"}`, textAlign: "center" }}>
        {isAuthenticated ? (
          <div style={{ color: "#2e7d32", fontSize: 13, lineHeight: 1.6 }}>
            ✅ Saved to your account. When you trigger SOS, the server sends alerts through the notification channels
            set up for this app (e-mail, push or webhook). Contacts need an <b>e-mail address</b> to receive e-mail alerts.
            The SMS / WhatsApp / Call buttons above always work from your own phone.
          </div>
        ) : (
          <div style={{ color: "#7a5200", fontSize: 13, lineHeight: 1.6 }}>
            Your circle is saved on this device. SOS opens your SMS and WhatsApp apps — <b>you tap Send</b>.
            {setScreen && <> <button type="button" onClick={() => setScreen("account")} style={{ background: "none", border: "none", color: "#c2185b", textDecoration: "underline", cursor: "pointer", fontSize: 13, padding: 0 }}>Sign in</button> to sync and enable automatic alerts.</>}
          </div>
        )}
      </div>
    </div>
  );
}
