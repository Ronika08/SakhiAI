export default function HomePage({
  APP_NAME,
  mood,
  handleMood,
  stats,
  cycleInfo,
  phaseLabel,
  fmtDate,
  setScreen,
  QUICK_ACTIONS,
  tipIdx,
  HEALTH_TIPS,
  cardStyle,
}) {
  return (
    <div style={{ padding: "20px 16px", paddingBottom: 80 }}>

      {/* Greeting + Mood */}
      <div style={{ ...cardStyle, background: "linear-gradient(135deg,#fff0f7,#f8f0ff)", border: "1px solid rgba(194,24,91,0.15)" }}>
        <div style={{ fontSize: 24, fontWeight: "bold", color: "#880e4f" }}>Welcome to {APP_NAME} 🌸</div>
        <div style={{ color: "#ad1457", fontSize: 13, marginTop: 4 }}>Your trusted companion for women's health, safety and wellbeing.</div>
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          {["😊","😌","😔","😤","😴"].map(e => (
            <button key={e} onClick={() => handleMood(e)} style={{
              fontSize: 24, background: mood === e ? "#fce4ec" : "rgba(255,255,255,0.7)",
              border: mood === e ? "2px solid #e91e63" : "2px solid transparent",
              borderRadius: 12, padding: "6px 10px", cursor: "pointer", transition: "all 0.2s",
            }}>{e}</button>
          ))}
        </div>
        {mood && <div style={{ color: "#c2185b", fontSize: 13, marginTop: 8 }}>Mood logged {mood} — taking care of yourself matters 🌸</div>}
      </div>

      {/* Portfolio Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Mood Logs",        value: stats.moodLogs,        icon: "😊", color: "#fce4ec", tc: "#c2185b" },
          { label: "Wellness Entries", value: stats.wellnessEntries, icon: "💪", color: "#e8f5e9", tc: "#2e7d32" },
          { label: "Safety Contacts",  value: stats.safetyContacts,  icon: "👥", color: "#fff3e0", tc: "#e65100" },
          { label: "Cycle Records",    value: stats.cycleRecords,    icon: "📅", color: "#f3e5f5", tc: "#7b1fa2" },
        ].map(({ label, value, icon, color, tc }) => (
          <div key={label} style={{ background: color, borderRadius: 14, padding: "14px 16px", border: `1px solid ${tc}22` }}>
            <div style={{ fontSize: 22 }}>{icon}</div>
            <div style={{ fontSize: 26, fontWeight: "bold", color: tc, lineHeight: 1.2 }}>{value}</div>
            <div style={{ fontSize: 11, color: tc, fontWeight: "bold", marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Cycle Phase */}
      {cycleInfo ? (
        <div style={{ background: "linear-gradient(135deg,#c2185b,#e91e63)", borderRadius: 20, padding: 18, marginBottom: 16, color: "#fff" }}>
          <div style={{ fontSize: 13, opacity: 0.9 }}>Current Phase</div>
          <div style={{ fontSize: 22, fontWeight: "bold" }}>{phaseLabel}</div>
          <div style={{ fontSize: 13, marginTop: 6, opacity: 0.9 }}>
            {cycleInfo.daysUntilNext > 0 ? `Next period in ${cycleInfo.daysUntilNext} days · ${fmtDate(cycleInfo.nextPeriod)}` : "Period may have started — stay comfortable 💕"}
          </div>
          <div style={{ fontSize: 12, marginTop: 4, opacity: 0.8 }}>
            Fertile window: {fmtDate(cycleInfo.fertileStart)} – {fmtDate(cycleInfo.fertileEnd)}
          </div>
        </div>
      ) : (
        <button onClick={() => setScreen("tracker")} style={{
          width: "100%", background: "linear-gradient(135deg,#fce4ec,#f8bbd0)",
          border: "2px dashed #e91e63", borderRadius: 16, padding: 16,
          color: "#c2185b", fontSize: 15, cursor: "pointer", marginBottom: 16, textAlign: "center",
        }}>📅 Set up your cycle tracker →</button>
      )}

      {/* Quick Actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        {QUICK_ACTIONS.map(a => (
          <button key={a.screen} className="card" onClick={() => setScreen(a.screen)} style={{
            background: "#fff", border: "1px solid rgba(194,24,91,0.15)",
            borderRadius: 16, padding: "18px 12px", cursor: "pointer",
            textAlign: "center", boxShadow: "0 2px 12px rgba(194,24,91,0.08)",
          }}>
            <div style={{ fontSize: 28 }}>{a.icon}</div>
            <div style={{ color: "#880e4f", fontWeight: "bold", fontSize: 14, marginTop: 6 }}>{a.label}</div>
          </button>
        ))}
      </div>

      {/* More nav buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Trusted Circle", icon: "👥", s: "circle"   },
          { label: "Safe Route",     icon: "🗺️", s: "route"    },
          { label: "Check-In",       icon: "⏱️", s: "checkin"  },
          { label: "Tips",           icon: "🌿", s: "tips"     },
        ].map(a => (
          <button key={a.s} className="card" onClick={() => setScreen(a.s)} style={{
            background: "#fff", border: "1px solid rgba(194,24,91,0.15)",
            borderRadius: 16, padding: "14px 12px", cursor: "pointer",
            textAlign: "center", boxShadow: "0 2px 12px rgba(194,24,91,0.08)",
          }}>
            <div style={{ fontSize: 24 }}>{a.icon}</div>
            <div style={{ color: "#880e4f", fontWeight: "bold", fontSize: 13, marginTop: 4 }}>{a.label}</div>
          </button>
        ))}
      </div>

      {/* Daily Tip */}
      <div key={tipIdx} className="tip-card" style={{
        background: "linear-gradient(135deg,#f3e5f5,#e8eaf6)", borderRadius: 16, padding: 16,
        border: "1px solid rgba(156,39,176,0.2)", marginBottom: 14,
      }}>
        <div style={{ fontSize: 11, color: "#7b1fa2", fontWeight: "bold", marginBottom: 6, letterSpacing: 1 }}>💡 DAILY TIP</div>
        <div style={{ fontSize: 22 }}>{HEALTH_TIPS[tipIdx].icon}</div>
        <div style={{ color: "#4a148c", fontSize: 14, marginTop: 4, lineHeight: 1.5 }}>{HEALTH_TIPS[tipIdx].tip}</div>
      </div>

      {/* About */}
      <div style={{ background: "linear-gradient(135deg,#fff0f7,#f3e5f5)", borderRadius: 16, padding: 16, marginBottom: 14, border: "1px solid rgba(194,24,91,0.15)" }}>
        <div style={{ fontWeight: "bold", color: "#880e4f", fontSize: 15, marginBottom: 8 }}>🌸 About {APP_NAME}</div>
        <div style={{ color: "#ad1457", fontSize: 13, lineHeight: 1.6 }}>
          {APP_NAME} combines women's health guidance, cycle tracking, wellness support, emergency safety tools, and AI-powered assistance in one platform designed to support women in everyday life and emergency situations.
        </div>
      </div>

      {/* Helplines */}
      <div style={{ background: "#fff3e0", borderRadius: 16, padding: 16, border: "1px solid rgba(255,152,0,0.3)" }}>
        <div style={{ fontWeight: "bold", color: "#e65100", marginBottom: 8 }}>📞 Important Helplines</div>
        {[["Women Helpline","1091"],["Emergency","112"],["Police","100"],["Ambulance","108"]].map(([n,d]) => (
          <div key={d} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(255,152,0,0.15)" }}>
            <span style={{ color: "#bf360c", fontSize: 13 }}>{n}</span>
            <a href={`tel:${d}`} style={{ color: "#e65100", fontWeight: "bold", fontSize: 14, textDecoration: "none" }}>{d}</a>
          </div>
        ))}
      </div>
    </div>
  );
}
