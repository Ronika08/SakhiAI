export default function ChatPage({
  messages,
  isLoading,
  chatEndRef,
  CHAT_SUGGESTIONS,
  inputText,
  setInputText,
  sendMessage,
  voiceOn,
  setVoiceOn,
  APP_NAME,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", paddingBottom: 0 }}>
        {messages.map((m, i) => (
          <div key={i} className="msg-bubble" style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 12 }}>
            {m.role === "assistant" && (
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#c2185b,#e91e63)", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 8, flexShrink: 0, fontSize: 16 }}>🌸</div>
            )}
            <div style={{
              maxWidth: "75%", whiteSpace: "pre-wrap",
              background: m.role === "user" ? "linear-gradient(135deg,#c2185b,#e91e63)" : "#fff",
              color: m.role === "user" ? "#fff" : "#333",
              borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              padding: "12px 16px", fontSize: 14, lineHeight: 1.6,
              boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
            }}>{m.content}</div>
          </div>
        ))}
        {isLoading && (
          <div style={{ display: "flex", gap: 8, padding: "8px 0" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#c2185b,#e91e63)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🌸</div>
            <div style={{ background: "#fff", borderRadius: 18, padding: "12px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.1)" }}>
              <span style={{ color: "#c2185b" }}>●</span><span style={{ color: "#e91e63", marginLeft: 4 }}>●</span><span style={{ color: "#f48fb1", marginLeft: 4 }}>●</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Suggestions */}
      <div style={{ padding: "8px 16px", overflowX: "auto", display: "flex", gap: 8, flexWrap: "nowrap" }}>
        {CHAT_SUGGESTIONS.map(s => (
          <button key={s} onClick={() => setInputText(s)} style={{
            flexShrink: 0, background: "#fce4ec", border: "1px solid #f48fb1",
            borderRadius: 20, padding: "6px 14px", fontSize: 12, color: "#c2185b",
            cursor: "pointer", whiteSpace: "nowrap",
          }}>{s}</button>
        ))}
      </div>

      {/* Input row */}
      <div style={{ padding: 16, background: "#fff", borderTop: "1px solid rgba(194,24,91,0.1)", display: "flex", gap: 10, alignItems: "center" }}>
        {/* Voice input placeholder */}
        <button title="Voice input (coming soon)" onClick={() => alert("🎤 Voice input feature coming soon!")} style={{
          background: "#fce4ec", border: "1px solid #f48fb1", borderRadius: "50%",
          width: 40, height: 40, fontSize: 18, cursor: "pointer", flexShrink: 0,
        }}>🎤</button>
        <input value={inputText} onChange={e => setInputText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage()}
          placeholder="Ask me anything about your health..."
          style={{ flex: 1, border: "2px solid rgba(194,24,91,0.3)", borderRadius: 24, padding: "12px 18px", fontSize: 14, outline: "none", background: "#fff0f7", color: "#333", fontFamily: "Georgia, serif" }}
        />
        {/* Voice response toggle placeholder */}
        <button title="Voice response (coming soon)" onClick={() => setVoiceOn(v => !v)} style={{
          background: voiceOn ? "#c2185b" : "#fce4ec",
          border: "1px solid #f48fb1", borderRadius: "50%",
          width: 40, height: 40, fontSize: 18, cursor: "pointer", flexShrink: 0,
        }}>🔊</button>
        <button onClick={sendMessage} disabled={isLoading} style={{
          background: "linear-gradient(135deg,#c2185b,#e91e63)", border: "none",
          borderRadius: "50%", width: 48, height: 48, color: "#fff", fontSize: 20,
          cursor: isLoading ? "not-allowed" : "pointer",
          boxShadow: "0 4px 15px rgba(194,24,91,0.4)", opacity: isLoading ? 0.7 : 1,
        }}>➤</button>
      </div>
      {voiceOn && (
        <div style={{ background: "#fce4ec", padding: "6px 16px", textAlign: "center", fontSize: 12, color: "#c2185b" }}>
          🔊 Voice responses enabled (coming soon — will read AI replies aloud)
        </div>
      )}
      <div style={{ padding: "6px 16px 10px", background: "#fff", textAlign: "center", fontSize: 11, color: "#ad1457", borderTop: "1px solid rgba(194,24,91,0.06)" }}>
        ⚠️ {APP_NAME} provides educational health information only and is not a substitute for professional medical advice.
      </div>
    </div>
  );
}
