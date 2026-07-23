export default function WellnessPage({
  cardStyle,
  sectionTitle,
  btnPrimary,
  water,
  setWater,
  sleep,
  setSleep,
  mood,
  handleMood,
  logWellness,
  moodHistory,
  wellnessLog,
}) {
  return (
    <div style={{ padding: 20, paddingBottom: 80 }}>
      <div style={{ fontWeight: "bold", fontSize: 22, color: "#880e4f", marginBottom: 4 }}>💪 Daily Wellness</div>
      <div style={{ color: "#ad1457", fontSize: 13, marginBottom: 20 }}>Track your daily health habits</div>

      {/* Water Intake */}
      <div style={cardStyle}>
        <div style={sectionTitle}>💧 Water Intake</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {[...Array(8)].map((_, i) => (
            <button key={i} onClick={() => setWater(i + 1)} style={{
              fontSize: 24, background: i < water ? "#e3f2fd" : "#f5f5f5",
              border: i < water ? "2px solid #1976d2" : "2px solid #ddd",
              borderRadius: 10, padding: "6px 8px", cursor: "pointer", transition: "all 0.2s",
            }}>💧</button>
          ))}
        </div>
        <div style={{ color: "#1565c0", fontWeight: "bold", fontSize: 15 }}>
          {water}/8 glasses {water >= 8 ? "🎉 Goal reached!" : `— ${8 - water} more to go`}
        </div>
      </div>

      {/* Sleep Tracker */}
      <div style={cardStyle}>
        <div style={sectionTitle}>😴 Sleep Last Night</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 8 }}>
          {["<5h","5-6h","6-7h","7-8h","8-9h",">9h"].map(s => (
            <button key={s} onClick={() => setSleep(s)} style={{
              background: sleep === s ? "linear-gradient(135deg,#c2185b,#e91e63)" : "#fce4ec",
              border: "none", borderRadius: 10, padding: "10px 6px",
              color: sleep === s ? "#fff" : "#c2185b",
              fontWeight: "bold", fontSize: 13, cursor: "pointer", transition: "all 0.2s",
            }}>{s}</button>
          ))}
        </div>
        {sleep && (
          <div style={{ color: "#880e4f", fontSize: 13, marginTop: 6 }}>
            {["<5h","5-6h"].includes(sleep) ? "😴 You need more rest! Aim for 7-9 hours." : "✨ Great sleep! Your hormones thank you."}
          </div>
        )}
      </div>

      {/* Today's mood summary */}
      <div style={cardStyle}>
        <div style={sectionTitle}>😊 Today's Mood</div>
        <div style={{ display: "flex", gap: 10 }}>
          {["😊","😌","😔","😤","😴"].map(e => (
            <button key={e} onClick={() => handleMood(e)} style={{
              fontSize: 28, background: mood === e ? "#fce4ec" : "rgba(255,255,255,0.7)",
              border: mood === e ? "2px solid #e91e63" : "2px solid #f5f5f5",
              borderRadius: 12, padding: "6px 10px", cursor: "pointer",
            }}>{e}</button>
          ))}
        </div>
        {mood && <div style={{ color: "#c2185b", fontSize: 13, marginTop: 8 }}>Current mood: {mood}</div>}
      </div>

      <button onClick={logWellness} style={btnPrimary}>💾 Save Today's Wellness Data</button>

      {/* Mood History */}
      {moodHistory.length > 0 && (
        <div style={{ ...cardStyle, marginTop: 16 }}>
          <div style={sectionTitle}>📊 Mood History (Last 30 days)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {moodHistory.slice(0, 14).map((m, i) => (
              <div key={i} style={{ background: "#fce4ec", borderRadius: 10, padding: "6px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 22 }}>{m.emoji}</div>
                <div style={{ fontSize: 10, color: "#ad1457", marginTop: 2 }}>{m.dayKey}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Wellness Log */}
      {wellnessLog.length > 0 && (
        <div style={{ ...cardStyle, marginTop: 16 }}>
          <div style={sectionTitle}>📋 Wellness Log</div>
          {wellnessLog.slice(0, 7).map((e, i) => (
            <div key={i} style={{ background: "#f0fff4", borderRadius: 10, padding: "10px 14px", marginBottom: 8 }}>
              <div style={{ color: "#2e7d32", fontWeight: "bold", fontSize: 12 }}>{e.date}</div>
              <div style={{ color: "#388e3c", fontSize: 13, marginTop: 4 }}>
                💧 {e.water}/8 water · 😴 {e.sleep || "—"} sleep · Mood: {e.mood || "—"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
