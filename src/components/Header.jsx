import { useLanguage } from "../i18n/LanguageContext";

export default function Header({
  screen,
  setScreen,
  APP_NAME,
  APP_TAGLINE: _APP_TAGLINE, // kept for backward compatibility; the tagline is now translated via t()
  accountLabel = "Account",
  isSignedIn = false,
}) {
  const { t } = useLanguage();
  return (
    <header
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
          aria-label={t("header.back")}
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
          {t("header.tagline")}
        </div>
      </div>

      <button
        onClick={() => setScreen("account")}
        aria-label={isSignedIn ? "Your account (signed in)" : "Sign in or create an account"}
        style={{
          background: "rgba(255,255,255,0.2)",
          border: "none",
          borderRadius: 20,
          color: "#fff",
          padding: "6px 10px",
          cursor: "pointer",
          fontSize: 13,
          minHeight: 36,
        }}
      >
        {isSignedIn ? "👤" : "🔐"} <span style={{ fontSize: 11 }}>{accountLabel}</span>
      </button>

      <button
        onClick={() => setScreen("emergency")}
        aria-label="Open emergency and SOS screen"
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
    </header>
  );
}