export default function SafeRoutePage({
  cardStyle,
  sectionTitle,
  inputStyle,
  btnPrimary,
  routeFrom,
  setRouteFrom,
  routeTo,
  setRouteTo,
  fetchLoc,
  contacts,
  APP_NAME,
}) {
  return (
    <div style={{ padding: 20, paddingBottom: 80 }}>
      <div style={{ fontWeight: "bold", fontSize: 22, color: "#880e4f", marginBottom: 4 }}>🗺️ Safe Route</div>
      <div style={{ color: "#ad1457", fontSize: 13, marginBottom: 20 }}>Plan your journey with safety in mind</div>

      <div style={cardStyle}>
        <div style={sectionTitle}>📍 Plan Your Route</div>
        <input value={routeFrom} onChange={e => setRouteFrom(e.target.value)}
          placeholder="📍 Starting point (e.g. Home, Office)"
          style={inputStyle} />
        <input value={routeTo} onChange={e => setRouteTo(e.target.value)}
          placeholder="🎯 Destination (e.g. Market, Friend's place)"
          style={{ ...inputStyle, marginBottom: 0 }} />
        <button style={{ ...btnPrimary, marginTop: 14, opacity: 0.7 }} onClick={() => alert("🗺️ Google Maps integration coming soon!\n\nThis will show safer routes, lit paths, and avoid unsafe areas.")}>
          🗺️ Find Safe Route (Coming Soon)
        </button>
      </div>

      {/* Placeholder map area */}
      <div style={{
        background: "linear-gradient(135deg,#e8eaf6,#f3e5f5)", borderRadius: 20, padding: 40,
        textAlign: "center", border: "2px dashed #9fa8da", marginBottom: 16,
      }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
        <div style={{ color: "#3949ab", fontWeight: "bold", fontSize: 16, marginBottom: 8 }}>
          Safe Route Map
        </div>
        <div style={{ color: "#5c6bc0", fontSize: 13, lineHeight: 1.6 }}>
          Google Maps integration coming soon.<br/>
          Will show safer, well-lit routes and avoid unsafe areas.
        </div>
      </div>

      {/* Quick share location */}
      <div style={cardStyle}>
        <div style={sectionTitle}>📡 Share Live Location</div>
        <div style={{ color: "#ad1457", fontSize: 13, marginBottom: 12, lineHeight: 1.6 }}>
          Share your real-time location with your Trusted Circle while travelling.
        </div>
        <button onClick={async () => {
          const loc = await fetchLoc();
          if (loc) {
            const msg = `📍 I'm sharing my location:\nhttps://maps.google.com/?q=${loc.lat},${loc.lng}\n— ${APP_NAME}`;
            const valid = contacts.filter(c => c.phone.trim());
            if (valid.length) window.open(`https://wa.me/${valid[0].phone.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`, "_blank");
            else alert("Add contacts in Trusted Circle first!");
          } else {
            alert("Location permission required. Please enable it in your browser.");
          }
        }} style={btnPrimary}>📡 Share My Location Now</button>
      </div>

      <div style={{ background: "#e8f5e9", borderRadius: 14, padding: 14, border: "1px solid #a5d6a7" }}>
        <div style={{ fontWeight: "bold", color: "#2e7d32", fontSize: 13, marginBottom: 6 }}>🔮 Coming Soon</div>
        <div style={{ color: "#388e3c", fontSize: 12, lineHeight: 1.7 }}>
          ✦ Google Maps safer route suggestions<br/>
          ✦ Avoid poorly lit or high-crime areas<br/>
          ✦ Live location sharing with trusted contacts<br/>
          ✦ Estimated arrival time alerts
        </div>
      </div>
    </div>
  );
}
