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
  activity = "",
  setActivity,
  stress = "",
  setStress,
  weeklySummary,
  isAuthenticated,
  syncState,
}) {
  return (
    <div style={{ padding: 20, paddingBottom: 80 }}>
      <h1 style={{ fontWeight: "bold", fontSize: 22, color: "#880e4f", marginBottom: 4, marginTop: 0 }}>💪 Daily Wellness</h1>
      <div style={{ color: "#ad1457", fontSize: 13, marginBottom: 20 }}>Track your daily health habits</div>

      {syncState?.loading && <div role="status" aria-busy="true" style={{ fontSize: 13, color: "#ad1457", marginBottom: 12 }}>Syncing your wellness data…</div>}
      {syncState?.error && <div role="alert" style={{ fontSize: 13, color: "#b71c1c", background: "#ffebee", border: "1px solid #ef9a9a", borderRadius: 10, padding: 10, marginBottom: 12 }}>{syncState.error}</div>}

      {/* Water Intake */}
      <div style={cardStyle}>
        <div style={sectionTitle}>💧 Water Intake</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {[...Array(8)].map((_, i) => (
            <button key={i} onClick={() => setWater(i + 1)} aria-label={`${i + 1} glass${i ? "es" : ""} of water`} aria-pressed={i < water} style={{
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
            <button key={s} onClick={() => setSleep(s)} aria-pressed={sleep === s} aria-label={`Slept ${s}`} style={{
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

      {/* Activity & stress */}
      <div style={cardStyle}>
        <div style={sectionTitle}>🏃 Activity & Stress</div>
        <label htmlFor="activity-min" style={{ display: "block", color: "#2e7d32", fontWeight: "bold", fontSize: 13, marginBottom: 6 }}>Exercise / activity today (minutes)</label>
        <input id="activity-min" type="number" inputMode="numeric" min={0} max={1440} value={activity}
          onChange={e => setActivity?.(e.target.value === "" ? "" : Math.max(0, Math.min(1440, Number(e.target.value))))}
          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid rgba(194,24,91,0.3)", fontSize: 14, boxSizing: "border-box", background: "#fff0f7", marginBottom: 12 }} />
        <div role="group" aria-labelledby="stress-label">
          <div id="stress-label" style={{ color: "#7b1fa2", fontWeight: "bold", fontSize: 13, marginBottom: 6 }}>Stress level (1 = calm, 5 = very stressed)</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setStress?.(n)} aria-pressed={stress === n} aria-label={`Stress level ${n} of 5`} style={{
                flex: 1, minHeight: 44, borderRadius: 10, border: "none", fontWeight: "bold", cursor: "pointer",
                background: stress === n ? "linear-gradient(135deg,#7b1fa2,#9c27b0)" : "#f3e5f5", color: stress === n ? "#fff" : "#7b1fa2",
              }}>{n}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Today's mood summary */}
      <div style={cardStyle}>
        <div style={sectionTitle}>😊 Today's Mood</div>
        <div style={{ display: "flex", gap: 10 }}>
          {["😊","😌","😔","😤","😴"].map(e => (
            <button key={e} onClick={() => handleMood(e)} aria-pressed={mood === e} aria-label={`Mood ${e}`} style={{
              fontSize: 28, background: mood === e ? "#fce4ec" : "rgba(255,255,255,0.7)",
              border: mood === e ? "2px solid #e91e63" : "2px solid #f5f5f5",
              borderRadius: 12, padding: "6px 10px", cursor: "pointer",
            }}>{e}</button>
          ))}
        </div>
        {mood && <div style={{ color: "#c2185b", fontSize: 13, marginTop: 8 }}>Current mood: {mood}</div>}
      </div>

      <button onClick={logWellness} style={btnPrimary}>💾 Save Today's Wellness Data</button>

      {/* Weekly summary (account) */}
      {isAuthenticated && weeklySummary && weeklySummary.daysLogged > 0 && (
        <div style={{ ...cardStyle, marginTop: 16 }}>
          <div style={sectionTitle}>📈 Last 7 days</div>
          <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: 0, fontSize: 13 }}>
            {[["Days logged", weeklySummary.daysLogged], ["Avg water", weeklySummary.averageWaterGlasses != null ? `${weeklySummary.averageWaterGlasses} glasses` : "—"],
              ["Avg activity", weeklySummary.averageActivityMinutes != null ? `${weeklySummary.averageActivityMinutes} min` : "—"], ["Avg stress", weeklySummary.averageStressLevel != null ? `${weeklySummary.averageStressLevel}/5` : "—"],
              ["Water goal met", `${weeklySummary.daysWaterGoalMet} day(s)`]].map(([k, v]) => (
              <div key={k} style={{ background: "#fce4ec", borderRadius: 10, padding: "8px 10px" }}>
                <dt style={{ color: "#ad1457", fontSize: 11 }}>{k}</dt>
                <dd style={{ margin: 0, color: "#880e4f", fontWeight: "bold" }}>{v}</dd>
              </div>
            ))}
          </dl>
          {weeklySummary.entries?.length > 1 && (
            <div role="img" aria-label="Water glasses per day over the last 7 days" style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 60, marginTop: 12 }}>
              {weeklySummary.entries.map(e => (
                <div key={e.date} title={`${e.date}: ${e.waterGlasses} glasses`} style={{ flex: 1, background: "#1976d2", borderRadius: "4px 4px 0 0", height: `${Math.min(100, ((e.waterGlasses || 0) / 8) * 100)}%`, minHeight: 3 }} />
              ))}
            </div>
          )}
        </div>
      )}

      {moodHistory.length === 0 && wellnessLog.length === 0 && !syncState?.loading && (
        <p style={{ textAlign: "center", color: "#777", fontSize: 13, marginTop: 24 }}>🌱 No history yet — save today's entry to start your log.</p>
      )}

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
                {e.activity !== undefined && e.activity !== "" ? ` · 🏃 ${e.activity} min` : ""}{e.stress ? ` · Stress ${e.stress}/5` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
