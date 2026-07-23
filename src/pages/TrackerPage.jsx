export default function TrackerPage({
  cardStyle,
  inputStyle,
  sectionTitle,
  btnPrimary,
  lmp,
  setLmp,
  cycleLength,
  setCycleLength,
  cycleInfo,
  phaseLabel,
  fmtDate,
  saveCycleEntry,
  cycleHistory,
}) {
  return (
    <div style={{ padding: 20, paddingBottom: 80 }}>
      <div style={{ fontWeight: "bold", fontSize: 22, color: "#880e4f", marginBottom: 4 }}>📅 Cycle Tracker</div>
      <div style={{ color: "#ad1457", fontSize: 13, marginBottom: 20 }}>Track your cycle for personalized insights</div>

      <div style={cardStyle}>
        <label style={{ display: "block", color: "#c2185b", fontWeight: "bold", marginBottom: 6, fontSize: 14 }}>📆 Last Period Start Date</label>
        <input type="date" value={lmp} onChange={e => setLmp(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
      </div>

      <div style={cardStyle}>
        <label style={{ display: "block", color: "#c2185b", fontWeight: "bold", marginBottom: 6, fontSize: 14 }}>
          🔄 Cycle Length: <span style={{ color: "#e91e63" }}>{cycleLength} days</span>
        </label>
        <input type="range" min={21} max={40} value={cycleLength} onChange={e => setCycleLength(+e.target.value)} style={{ width: "100%", accentColor: "#e91e63" }} />
        <div style={{ display: "flex", justifyContent: "space-between", color: "#aaa", fontSize: 12, marginTop: 4 }}>
          <span>21</span><span>28 (avg)</span><span>40</span>
        </div>
      </div>

      {cycleInfo && (
        <>
          <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
            {[
              { label: "Next Period",    value: fmtDate(cycleInfo.nextPeriod),  icon: "🩸", color: "#fce4ec", tc: "#c2185b" },
              { label: "Ovulation Day",  value: fmtDate(cycleInfo.ovulation),   icon: "🥚", color: "#e8f5e9", tc: "#2e7d32" },
              { label: "Fertile Window", value: `${fmtDate(cycleInfo.fertileStart)} – ${fmtDate(cycleInfo.fertileEnd)}`, icon: "🌸", color: "#fff3e0", tc: "#e65100" },
              { label: "Current Phase",  value: phaseLabel,                      icon: "📊", color: "#f3e5f5", tc: "#7b1fa2" },
            ].map(({ label, value, icon, color, tc }) => (
              <div key={label} style={{ background: color, borderRadius: 16, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 28 }}>{icon}</span>
                <div>
                  <div style={{ fontSize: 11, color: tc, fontWeight: "bold", letterSpacing: 0.5 }}>{label.toUpperCase()}</div>
                  <div style={{ fontSize: 15, color: tc, fontWeight: "bold", marginTop: 2 }}>{value}</div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={saveCycleEntry} style={btnPrimary}>💾 Save Cycle Entry</button>
        </>
      )}

      {!lmp && <div style={{ textAlign: "center", color: "#bbb", marginTop: 40, fontSize: 14 }}>🌸 Enter your last period date to see predictions</div>}

      {/* Cycle History */}
      {cycleHistory.length > 0 && (
        <div style={{ ...cardStyle, marginTop: 20 }}>
          <div style={sectionTitle}>📋 Cycle History</div>
          {cycleHistory.map((entry, i) => (
            <div key={i} style={{ background: "#fff0f7", borderRadius: 10, padding: "10px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: "#880e4f", fontWeight: "bold", fontSize: 13 }}>{entry.date}</div>
                <div style={{ color: "#ad1457", fontSize: 12 }}>{entry.cycleLength}-day cycle · {entry.phase}</div>
              </div>
              <div style={{ color: "#bbb", fontSize: 11 }}>{entry.logged}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
