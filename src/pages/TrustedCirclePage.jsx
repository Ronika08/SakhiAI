export default function TrustedCirclePage({
  cardStyle,
  sectionTitle,
  inputStyle,
  contacts,
  updateContact,
  RELATIONSHIP_OPTIONS,
  contactAlertMsg,
}) {
  return (
    <div style={{ padding: 20, paddingBottom: 80 }}>
      <div style={{ fontWeight: "bold", fontSize: 22, color: "#880e4f", marginBottom: 4 }}>👥 Trusted Circle</div>
      <div style={{ color: "#ad1457", fontSize: 13, marginBottom: 20 }}>Your 3 closest emergency contacts</div>

      {contacts.map((c, i) => (
        <div key={i} style={{ ...cardStyle, border: "1px solid rgba(194,24,91,0.15)" }}>
          <div style={{ ...sectionTitle, marginBottom: 12 }}>Contact {i + 1}</div>
          <input value={c.name} placeholder={`Name (e.g. ${["Mom","Best Friend","Sister"][i] || "Contact"})`}
            onChange={e => updateContact(i, "name", e.target.value)} style={inputStyle} />
          <input value={c.phone} placeholder="+91XXXXXXXXXX"
            onChange={e => updateContact(i, "phone", e.target.value)} style={inputStyle} />
          <select value={c.relationship} onChange={e => updateContact(i, "relationship", e.target.value)} style={{ ...inputStyle, marginBottom: 0 }}>
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
        </div>
      ))}
      <div style={{ background: "#e8f5e9", borderRadius: 14, padding: 14, border: "1px solid #a5d6a7", textAlign: "center" }}>
        <div style={{ color: "#2e7d32", fontSize: 13 }}>✅ Your trusted circle is saved automatically. They'll be alerted when you trigger SOS.</div>
      </div>
    </div>
  );
}
