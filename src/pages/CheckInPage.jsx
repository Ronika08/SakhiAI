export default function CheckInPage({
  cardStyle,
  sectionTitle,
  btnPrimary,
  checkInMins,
  setCheckInMins,
  checkInActive,
  startCheckIn,
  checkInRemain,
  confirmSafe,
  fmtRemain,
}) {
  return (
    <div style={{ padding: 20, paddingBottom: 80 }}>
      <div style={{ fontWeight: "bold", fontSize: 22, color: "#880e4f", marginBottom: 4 }}>⏱️ Safety Check-In</div>
      <div style={{ color: "#ad1457", fontSize: 13, marginBottom: 20 }}>Schedule a safety timer — if you don't confirm in time, an alert will trigger</div>

      <div style={cardStyle}>
        <div style={sectionTitle}>⏱️ Set Check-In Timer</div>
        <label style={{ color: "#c2185b", fontWeight: "bold", fontSize: 13, display: "block", marginBottom: 6 }}>
          I'll check back in: <span style={{ color: "#e91e63" }}>{checkInMins} minutes</span>
        </label>
        <input type="range" min={5} max={120} step={5} value={checkInMins}
          onChange={e => setCheckInMins(+e.target.value)}
          style={{ width: "100%", accentColor: "#e91e63", marginBottom: 8 }} />
        <div style={{ display: "flex", justifyContent: "space-between", color: "#aaa", fontSize: 12, marginBottom: 16 }}>
          <span>5 min</span><span>30 min</span><span>60 min</span><span>2 hrs</span>
        </div>

        {/* Quick select */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {[10,15,30,45,60,90].map(m => (
            <button key={m} onClick={() => setCheckInMins(m)} style={{
              background: checkInMins === m ? "linear-gradient(135deg,#c2185b,#e91e63)" : "#fce4ec",
              border: "none", borderRadius: 10, padding: "8px 14px",
              color: checkInMins === m ? "#fff" : "#c2185b",
              fontWeight: "bold", fontSize: 13, cursor: "pointer",
            }}>{m}m</button>
          ))}
        </div>

        {!checkInActive ? (
          <button onClick={startCheckIn} style={btnPrimary}>▶ Start Check-In Timer</button>
        ) : (
          <div>
            <div style={{ background: "linear-gradient(135deg,#e8f5e9,#f1f8e9)", borderRadius: 14, padding: 16, textAlign: "center", marginBottom: 12, border: "2px solid #4caf50" }}>
              <div style={{ color: "#2e7d32", fontWeight: "bold", fontSize: 14 }}>✅ Check-In Active</div>
              <div style={{ fontSize: 32, fontWeight: "bold", color: "#1b5e20", marginTop: 4 }}>{fmtRemain(checkInRemain)}</div>
              <div style={{ color: "#388e3c", fontSize: 12, marginTop: 4 }}>remaining — confirm before timer ends</div>
            </div>
            <button onClick={confirmSafe} style={{ ...btnPrimary, background: "linear-gradient(135deg,#2e7d32,#4caf50)", marginBottom: 10 }}>
              ✅ I'm Safe — Confirm Check-In
            </button>
            <button onClick={confirmSafe} style={{ ...btnPrimary, background: "#f5f5f5", color: "#888" }}>
              Cancel Timer
            </button>
          </div>
        )}
      </div>

      <div style={{ background: "#fff8e1", borderRadius: 14, padding: 14, border: "1px solid #ffe082" }}>
        <div style={{ fontWeight: "bold", color: "#f57f17", fontSize: 13, marginBottom: 6 }}>💡 How it works</div>
        <div style={{ color: "#e65100", fontSize: 12, lineHeight: 1.7 }}>
          1. Set a timer before going somewhere alone<br/>
          2. A banner alert appears when time expires<br/>
          3. Tap "I'm Safe" to dismiss, or trigger SOS<br/>
          4. Best used when travelling alone at night
        </div>
      </div>
    </div>
  );
}
