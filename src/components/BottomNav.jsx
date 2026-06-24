export default function BottomNav({ screen, setScreen }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 430,
        background: "#fff",
        borderTop: "1px solid rgba(194,24,91,0.15)",
        display: "flex",
        padding: "8px 0",
        boxShadow: "0 -4px 20px rgba(194,24,91,0.1)",
      }}
    >
      {[
        { icon: "🏠", label: "Home", s: "home" },
        { icon: "📅", label: "Tracker", s: "tracker" },
        { icon: "💬", label: "Chat", s: "chat" },
        { icon: "💪", label: "Wellness", s: "wellness" },
        { icon: "🚨", label: "Safety", s: "emergency" },
      ].map(({ icon, label, s }) => (
        <button
          key={s}
          onClick={() => setScreen(s)}
          style={{
            flex: 1,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "6px 0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 20 }}>{icon}</span>
          <span
            style={{
              fontSize: 10,
              color: screen === s ? "#c2185b" : "#999",
              marginTop: 2,
            }}
          >
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}