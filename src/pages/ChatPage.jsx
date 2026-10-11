import { VoiceButton, VoiceStatus } from "../components/VoiceButton";
import LanguageSelector from "../components/LanguageSelector";
import { ttsSupported } from "../services/tts";

/** Small provenance line under assistant replies: offline-capable vs internet-dependent. */
function Source({ m, t }) {
  if (m.role !== "assistant" || !m.source) return null;
  const local = m.source === "rule" || m.source === "kb";
  const ai = m.source === "ai";
  if (!local && !ai) return null;
  return (
    <div style={{ fontSize: 11, color: local ? "#2e7d32" : "#7a3d00", marginTop: 6 }}>
      {local ? "✅ " : "🌐 "}{local ? t("chat.source.local") : t("chat.source.ai")}
      {m.translated === false && <div style={{ color: "#6b6b6b" }}>{t("chat.translationNote")}</div>}
    </div>
  );
}

export default function ChatPage({
  messages,
  isLoading,
  chatEndRef,
  suggestions,
  inputText,
  setInputText,
  sendMessage,
  voiceOn,
  setVoiceOn,
  APP_NAME,
  t,
  voice,
  connectivity,
}) {
  const offline = connectivity !== "online";
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 16px 0", flexWrap: "wrap" }}>
        <h1 className="sr-only">{t("nav.chat")}</h1>
        <LanguageSelector />
        <span role="status" style={{ fontSize: 11, color: offline ? "#b71c1c" : "#2e7d32", fontWeight: "bold" }}>
          {offline ? `🔴 ${t("conn.offline")}` : "🟢 Online"}
        </span>
      </div>

      <div role="log" aria-live="polite" aria-relevant="additions" aria-label={t("chat.log")}
        style={{ flex: 1, overflowY: "auto", padding: "16px", paddingBottom: 0 }}>
        {messages.map((m, i) => (
          <div key={i} className="msg-bubble" style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 12 }}>
            {m.role === "assistant" && (
              <div aria-hidden="true" style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#c2185b,#e91e63)", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 8, flexShrink: 0, fontSize: 16 }}>🌸</div>
            )}
            <div style={{
              maxWidth: "75%", whiteSpace: "pre-wrap",
              background: m.role === "user" ? "linear-gradient(135deg,#c2185b,#e91e63)" : "#fff",
              color: m.role === "user" ? "#fff" : "#333",
              borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              padding: "12px 16px", fontSize: 14, lineHeight: 1.6,
              boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
            }}>
              <span className="sr-only">{m.role === "user" ? "You: " : `${APP_NAME}: `}</span>
              {m.content}
              <Source m={m} t={t} />
            </div>
          </div>
        ))}
        {isLoading && (
          <div role="status" aria-label={t("common.loading")} style={{ display: "flex", gap: 8, padding: "8px 0" }}>
            <div aria-hidden="true" style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#c2185b,#e91e63)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🌸</div>
            <div style={{ background: "#fff", borderRadius: 18, padding: "12px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.1)" }}>
              <span aria-hidden="true" style={{ color: "#c2185b" }}>●</span><span aria-hidden="true" style={{ color: "#e91e63", marginLeft: 4 }}>●</span><span aria-hidden="true" style={{ color: "#f48fb1", marginLeft: 4 }}>●</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Suggestions */}
      <div style={{ padding: "8px 16px", overflowX: "auto", display: "flex", gap: 8, flexWrap: "nowrap" }}>
        {suggestions.map(s => (
          <button key={s} onClick={() => setInputText(s)} style={{
            flexShrink: 0, background: "#fce4ec", border: "1px solid #f48fb1",
            borderRadius: 20, padding: "6px 14px", fontSize: 12, color: "#a0144f",
            cursor: "pointer", whiteSpace: "nowrap", minHeight: 36,
          }}>{s}</button>
        ))}
      </div>

      <VoiceStatus voice={voice} t={t} />

      {/* Input row */}
      <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
        style={{ padding: 16, background: "#fff", borderTop: "1px solid rgba(194,24,91,0.1)", display: "flex", gap: 10, alignItems: "center" }}>
        <VoiceButton voice={voice} t={t} />
        <label htmlFor="chat-input" className="sr-only">{t("chat.placeholder")}</label>
        <input id="chat-input" value={inputText} onChange={e => setInputText(e.target.value)}
          placeholder={t("chat.placeholder")} autoComplete="off" maxLength={2000}
          style={{ flex: 1, minWidth: 0, border: "2px solid rgba(194,24,91,0.3)", borderRadius: 24, padding: "12px 18px", fontSize: 14, background: "#fff0f7", color: "#333", fontFamily: "Georgia, 'Noto Sans Devanagari', 'Noto Sans Kannada', serif" }}
        />
        {ttsSupported() && (
          <button type="button" onClick={() => setVoiceOn(v => !v)} aria-pressed={voiceOn}
            aria-label={voiceOn ? t("speak.on") : t("speak.off")} title={voiceOn ? t("speak.on") : t("speak.off")} style={{
            background: voiceOn ? "#c2185b" : "#fce4ec", color: voiceOn ? "#fff" : "#880e4f",
            border: "1px solid #f48fb1", borderRadius: "50%",
            width: 44, height: 44, fontSize: 18, cursor: "pointer", flexShrink: 0,
          }}><span aria-hidden="true">🔊</span></button>
        )}
        <button type="submit" disabled={isLoading} aria-label={t("chat.send")} style={{
          background: "linear-gradient(135deg,#c2185b,#e91e63)", border: "none",
          borderRadius: "50%", width: 48, height: 48, color: "#fff", fontSize: 20,
          cursor: isLoading ? "not-allowed" : "pointer",
          boxShadow: "0 4px 15px rgba(194,24,91,0.4)", opacity: isLoading ? 0.7 : 1, flexShrink: 0,
        }}><span aria-hidden="true">➤</span></button>
      </form>
      <div style={{ padding: "6px 16px 10px", background: "#fff", textAlign: "center", fontSize: 11, color: "#8a1450", borderTop: "1px solid rgba(194,24,91,0.06)" }}>
        {t("chat.disclaimer", { app: APP_NAME })}
      </div>
    </div>
  );
}
