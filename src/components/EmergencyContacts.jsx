export default function EmergencyContacts({
  contacts,
  setScreen,
  contactAlertMsg,
  cardStyle,
  btnPrimary,
}) {
  return (
    <div style={{ ...cardStyle, marginBottom: 16 }}>
      <div style={{ fontWeight: "bold", color: "#b71c1c", marginBottom: 6, fontSize: 16 }}>👥 Emergency Contacts</div>
      <div style={{ fontSize: 12, color: "#e53935", marginBottom: 12, background: "#fff8f8", borderRadius: 8, padding: "8px 12px", border: "1px solid #ffcdd2" }}>
        💡 SMS app opens pre-filled with your number + location. Just tap <b>Send</b>!
      </div>
      {contacts.map((c, i) => c.phone ? (
        <div key={i} style={{ background: "#fff5f5", borderRadius: 12, padding: "10px 14px", marginBottom: 10, border: "1px solid #ffcdd2" }}>
          <div style={{ color: "#b71c1c", fontWeight: "bold", fontSize: 14, marginBottom: 8 }}>
            {c.name || `Contact ${i+1}`} <span style={{ color: "#e53935", fontWeight: "normal", fontSize: 12 }}>({c.relationship})</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <a href={`sms:${c.phone}?body=${encodeURIComponent(contactAlertMsg())}`} style={{ flex:1, background:"linear-gradient(135deg,#1565c0,#1976d2)", color:"#fff", padding:"8px 0", borderRadius:10, textAlign:"center", textDecoration:"none", fontWeight:"bold", fontSize:12 }}>📱 SMS</a>
            <a href={`https://wa.me/${c.phone.replace(/\D/g,"")}?text=${encodeURIComponent(contactAlertMsg())}`} target="_blank" rel="noreferrer" style={{ flex:1, background:"linear-gradient(135deg,#1b5e20,#2e7d32)", color:"#fff", padding:"8px 0", borderRadius:10, textAlign:"center", textDecoration:"none", fontWeight:"bold", fontSize:12 }}>🟢 WhatsApp</a>
            <a href={`tel:${c.phone}`} style={{ flex:1, background:"linear-gradient(135deg,#e65100,#f4511e)", color:"#fff", padding:"8px 0", borderRadius:10, textAlign:"center", textDecoration:"none", fontWeight:"bold", fontSize:12 }}>📞 Call</a>
          </div>
        </div>
      ) : null)}
      <button onClick={() => setScreen("circle")} style={{ ...btnPrimary, background: "linear-gradient(135deg,#880e4f,#c2185b)", marginTop: 4 }}>
        👥 Manage Trusted Circle
      </button>
    </div>
  );
}
