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
  cycleFlow = "",
  setCycleFlow,
  cycleSymptoms = [],
  setCycleSymptoms,
  cycleNotes = "",
  setCycleNotes,
  deleteCycleEntry,
  cyclePrediction,
  isAuthenticated,
}) {
  const toggleSymptom = (key) =>
    setCycleSymptoms?.(cycleSymptoms.includes(key) ? cycleSymptoms.filter((x) => x !== key) : [...cycleSymptoms, key]);
  const irregular = cyclePrediction?.irregular;
  return (
    <div style={{ padding: 20, paddingBottom: 80 }}>
      <h1 style={{ fontWeight: "bold", fontSize: 22, color: "#880e4f", marginBottom: 4, marginTop: 0 }}>📅 Cycle Tracker</h1>
      <div style={{ color: "#ad1457", fontSize: 13, marginBottom: 20 }}>Track your cycle for personalized insights</div>

      <div style={cardStyle}>
        <label htmlFor="lmp-date" style={{ display: "block", color: "#c2185b", fontWeight: "bold", marginBottom: 6, fontSize: 14 }}>📆 Last Period Start Date</label>
        <input id="lmp-date" type="date" max={new Date().toISOString().slice(0, 10)} value={lmp} onChange={e => setLmp(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
      </div>

      <div style={cardStyle}>
        <label htmlFor="cycle-length" style={{ display: "block", color: "#c2185b", fontWeight: "bold", marginBottom: 6, fontSize: 14 }}>
          🔄 Cycle Length: <span style={{ color: "#e91e63" }}>{cycleLength} days</span>
        </label>
        <input id="cycle-length" type="range" min={21} max={40} value={cycleLength} onChange={e => setCycleLength(+e.target.value)} style={{ width: "100%", accentColor: "#e91e63" }} />
        <div style={{ display: "flex", justifyContent: "space-between", color: "#6b6b6b", fontSize: 12, marginTop: 4 }}>
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

          {irregular && (
            <div role="status" style={{ background: "#fff3e0", border: "1px solid #ffcc80", borderRadius: 12, padding: 12, fontSize: 13, color: "#7a3d00", marginBottom: 12, lineHeight: 1.5 }}>
              ⚠️ Your logged cycle lengths vary a lot, so these estimates are unreliable. Consider talking to a healthcare professional about your cycle.
            </div>
          )}

          {/* Optional details */}
          <div style={cardStyle}>
            <div style={sectionTitle}>📝 Add details (optional)</div>
            <label htmlFor="cycle-flow" style={{ display: "block", color: "#c2185b", fontWeight: "bold", fontSize: 13, marginBottom: 6 }}>Flow</label>
            <select id="cycle-flow" value={cycleFlow} onChange={e => setCycleFlow?.(e.target.value)} style={inputStyle}>
              <option value="">Not specified</option>
              {["spotting", "light", "medium", "heavy"].map(f => <option key={f} value={f}>{f[0].toUpperCase() + f.slice(1)}</option>)}
            </select>
            <fieldset style={{ border: "none", padding: 0, margin: "0 0 10px" }}>
              <legend style={{ color: "#c2185b", fontWeight: "bold", fontSize: 13, marginBottom: 6, padding: 0 }}>Symptoms</legend>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {[["cramps", "Cramps"], ["headache", "Headache"], ["bloating", "Bloating"], ["fatigue", "Fatigue"], ["backache", "Backache"], ["nausea", "Nausea"], ["acne", "Acne"], ["tender_breasts", "Tender breasts"], ["mood_swings", "Mood swings"], ["food_cravings", "Cravings"]].map(([key, label]) => (
                  <button type="button" key={key} onClick={() => toggleSymptom(key)} aria-pressed={cycleSymptoms.includes(key)} style={{
                    background: cycleSymptoms.includes(key) ? "linear-gradient(135deg,#c2185b,#e91e63)" : "#fce4ec",
                    color: cycleSymptoms.includes(key) ? "#fff" : "#a0144f", border: "none", borderRadius: 16, padding: "8px 12px", fontSize: 12, fontWeight: "bold", cursor: "pointer", minHeight: 36,
                  }}>{label}</button>
                ))}
              </div>
            </fieldset>
            <label htmlFor="cycle-notes" style={{ display: "block", color: "#c2185b", fontWeight: "bold", fontSize: 13, marginBottom: 6 }}>Notes</label>
            <textarea id="cycle-notes" value={cycleNotes} onChange={e => setCycleNotes?.(e.target.value)} maxLength={1000} rows={3} style={{ ...inputStyle, marginBottom: 0, resize: "vertical", fontFamily: "inherit" }} />
          </div>

          <button onClick={saveCycleEntry} style={btnPrimary}>💾 Save Cycle Entry</button>
        </>
      )}

      {!lmp && <div style={{ textAlign: "center", color: "#777", marginTop: 40, fontSize: 14 }}>🌸 Enter your last period date to see predictions</div>}

      <p style={{ fontSize: 12, color: "#777", lineHeight: 1.5, margin: "16px 0 0" }}>
        ℹ️ Dates are <b>estimates</b> based on the information you enter — not medical advice, and not a method of contraception.
        Cycles vary. Talk to a healthcare professional about irregular, very painful or concerning periods.
        {isAuthenticated && cyclePrediction?.confidence && <> Estimate confidence: <b>{cyclePrediction.confidence}</b>.</>}
      </p>

      {/* Cycle History */}
      {cycleHistory.length > 0 && (
        <div style={{ ...cardStyle, marginTop: 20 }}>
          <div style={sectionTitle}>📋 Cycle History</div>
          {cycleHistory.map((entry, i) => (
            <div key={i} style={{ background: "#fff0f7", borderRadius: 10, padding: "10px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: "#880e4f", fontWeight: "bold", fontSize: 13 }}>{entry.date}</div>
                <div style={{ color: "#ad1457", fontSize: 12 }}>
                  {entry.cycleLength}-day cycle{entry.phase ? ` · ${entry.phase}` : ""}{entry.flow ? ` · ${entry.flow} flow` : ""}
                  {entry.symptoms?.length ? ` · ${entry.symptoms.map(x => x.replace("_", " ")).join(", ")}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ color: "#777", fontSize: 11 }}>{entry.logged}</div>
                {deleteCycleEntry && (
                  <button onClick={() => deleteCycleEntry(entry)} aria-label={`Delete cycle entry for ${entry.date}`}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, minWidth: 36, minHeight: 36, color: "#c62828" }}>🗑</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
