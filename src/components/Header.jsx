export default function Header({
  screen,
  setScreen,
  APP_NAME,
  APP_TAGLINE,
}) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg,#c2185b,#880e4f)",
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 4px 20px rgba(194,24,91,0.3)",
      }}
    >
      {screen !== "home" && (
        <button
          onClick={() => setScreen("home")}
          style={{
            background: "rgba(255,255,255,0.2)",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            padding: "4px 10px",
            cursor: "pointer",
            fontSize: 18,
          }}
        >
          ←
        </button>
      )}

      <div style={{ flex: 1 }}>
        <div
          style={{
            color: "#fff",
            fontWeight: "bold",
            fontSize: 20,
            letterSpacing: 1,
          }}
        >
          🌸 {APP_NAME}
        </div>

        <div
          style={{
            color: "rgba(255,255,255,0.8)",
            fontSize: 11,
          }}
        >
          {APP_TAGLINE}
        </div>
      </div>

      <button
        onClick={() => setScreen("emergency")}
        style={{
          background: "#ff1744",
          border: "none",
          borderRadius: 20,
          color: "#fff",
          padding: "6px 14px",
          cursor: "pointer",
          fontWeight: "bold",
          fontSize: 13,
          boxShadow: "0 2px 10px rgba(255,23,68,0.5)",
          animation: "pulse 2s infinite",
        }}
      >
        🚨 SOS
      </button>
    </div>
  );
}