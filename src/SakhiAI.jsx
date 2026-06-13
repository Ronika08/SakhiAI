import { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────
// CONFIG — AI model & endpoint settings
// TODO: Move API_BASE_URL to .env when migrating to Node.js backend
// TODO: Replace direct Anthropic calls with: fetch(`${API_BASE_URL}/api/chat`, ...)
// ─────────────────────────────────────────────
const AI_CONFIG = {
  model: "claude-sonnet-4-20250514",
  maxTokens: 1000,
  apiUrl: "https://api.anthropic.com/v1/messages",
  // TODO: apiUrl: import.meta.env.VITE_API_URL || "/api/chat"  ← for backend
};

const APP_NAME = "SakhiAI";
const APP_TAGLINE = "Your Trusted Women's Safety & Health Companion";
const SOS_SIGNATURE = `Sent via ${APP_NAME}`;

// ─────────────────────────────────────────────
// SYSTEM PROMPT — AI persona & behaviour rules
// ─────────────────────────────────────────────
const SYSTEM_PROMPT = `You are SakhiAI, a compassionate, knowledgeable women's health and safety assistant specializing in menstrual health, PCOS, pregnancy, nutrition, mental wellbeing, women's safety, emergency preparedness, and self-care.

Guidelines:
- Be warm, empathetic, and supportive.
- Provide medically responsible information.
- Always encourage professional medical consultation when appropriate.
- For emergencies, immediately recommend emergency services.
- Mention Indian emergency numbers when relevant (Women Helpline: 1091, Police: 100, Emergency: 112).
- Never claim to diagnose medical conditions.
- Keep responses concise and helpful.`;

// ─────────────────────────────────────────────
// STATIC DATA
// ─────────────────────────────────────────────
const HEALTH_TIPS = [
  { icon: "💧", tip: "Drink 8 glasses of water daily for hormonal balance" },
  { icon: "🧘", tip: "10 min meditation reduces cortisol & PMS symptoms" },
  { icon: "🥗", tip: "Iron-rich foods ease fatigue during your period" },
  { icon: "😴", tip: "7-9 hours sleep regulates your menstrual cycle" },
  { icon: "🚶", tip: "30 min walk daily improves PCOS symptoms by 30%" },
  { icon: "🌿", tip: "Spearmint tea helps reduce androgen levels in PCOS" },
];

const QUICK_ACTIONS = [
  { label: "Period Tracker", icon: "📅", screen: "tracker" },
  { label: "AI Chat",        icon: "💬", screen: "chat"    },
  { label: "Health Tips",    icon: "🌿", screen: "tips"    },
  { label: "Emergency",      icon: "🚨", screen: "emergency" },
];

const NATIONAL_HELPLINES = [
  ["🚔 Police",              "100"],
  ["🚑 Ambulance",           "108"],
  ["🆘 Emergency",           "112"],
  ["👩 Women Helpline",      "1091"],
  ["💜 Domestic Violence",   "181"],
  ["🧠 Mental Health (iCall)", "9152987821"],
];

const CHAT_SUGGESTIONS = [
  "Period cramps relief",
  "PCOS diet tips",
  "Ovulation signs",
  "Stress & hormones",
];

// ─────────────────────────────────────────────
// INITIAL CHAT MESSAGES
// ─────────────────────────────────────────────
const INITIAL_MESSAGES = [
  {
    role: "assistant",
    content: `Hi there 🌸 I'm ${APP_NAME}, your trusted women's safety and health companion. Ask me anything about your health, cycle, nutrition, wellbeing, or safety.`,
  },
];

// ─────────────────────────────────────────────
// LOCAL STORAGE HELPERS
// TODO: Replace with backend API calls when migrating to Node.js
// ─────────────────────────────────────────────
const LS_KEYS = {
  mood:             "sakhi_mood",
  lmp:              "sakhi_lmp",
  cycleLength:      "sakhi_cycleLength",
  contacts:         "sakhi_contacts",
  lastSosTimestamp: "sakhi_lastSosTimestamp",
  lastSosLocation:  "sakhi_lastSosLocation",
};

function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota exceeded — silent fail */ }
}

// ─────────────────────────────────────────────
// CYCLE CALCULATION UTILITY
// ─────────────────────────────────────────────
function computeCycleInfo(lmp, cycleLength) {
  if (!lmp) return null;
  const lmpDate    = new Date(lmp);
  const today      = new Date();
  const nextPeriod = new Date(lmpDate);
  nextPeriod.setDate(nextPeriod.getDate() + cycleLength);
  const ovulation  = new Date(lmpDate);
  ovulation.setDate(ovulation.getDate() + cycleLength - 14);
  const fertileStart = new Date(ovulation);
  fertileStart.setDate(fertileStart.getDate() - 5);
  const fertileEnd = new Date(ovulation);
  fertileEnd.setDate(fertileEnd.getDate() + 1);
  const daysUntilNext = Math.ceil((nextPeriod - today) / (1000 * 60 * 60 * 24));
  const dayOfCycle    = Math.ceil((today - lmpDate)    / (1000 * 60 * 60 * 24));
  return { nextPeriod, ovulation, fertileStart, fertileEnd, daysUntilNext, dayOfCycle };
}

function fmtDate(d) {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ─────────────────────────────────────────────
// ROOT COMPONENT
// ─────────────────────────────────────────────
export default function App() {

  // ── Navigation ──
  const [screen, setScreen] = useState("home");

  // ── Chat state ──
  const [messages,   setMessages] = useState(INITIAL_MESSAGES);
  const [inputText,  setInputText] = useState("");
  const [isLoading,  setIsLoading] = useState(false);
  const chatEndRef = useRef(null);

  // ── Cycle tracker state — persisted ──
  const [lmp,         setLmp]         = useState(() => lsGet(LS_KEYS.lmp,         ""));
  const [cycleLength, setCycleLength] = useState(() => lsGet(LS_KEYS.cycleLength, 28));

  // ── Emergency state ──
  const [emergencyContacts, setEmergencyContacts] = useState(
    () => lsGet(LS_KEYS.contacts, [{ name: "", phone: "" }])
  );
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [sosSent,         setSosSent]         = useState(false);
  const [lastSosTime,     setLastSosTime]     = useState(() => lsGet(LS_KEYS.lastSosTimestamp, null));
  const [lastSosLocation, setLastSosLocation] = useState(() => lsGet(LS_KEYS.lastSosLocation,  null));
  const [currentLocation, setCurrentLocation] = useState(null);

  // ── UI state — persisted ──
  const [mood,   setMoodState] = useState(() => lsGet(LS_KEYS.mood, null));
  const [tipIdx, setTipIdx]   = useState(0);

  // ─────────────────────────────────────────────
  // PERSISTENCE EFFECTS
  // ─────────────────────────────────────────────
  useEffect(() => { lsSet(LS_KEYS.mood,        mood);             }, [mood]);
  useEffect(() => { lsSet(LS_KEYS.lmp,         lmp);              }, [lmp]);
  useEffect(() => { lsSet(LS_KEYS.cycleLength, cycleLength);      }, [cycleLength]);
  useEffect(() => { lsSet(LS_KEYS.contacts,    emergencyContacts); }, [emergencyContacts]);

  // Scroll chat to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Rotate health tip every 4 seconds
  useEffect(() => {
    const timer = setInterval(() => setTipIdx(i => (i + 1) % HEALTH_TIPS.length), 4000);
    return () => clearInterval(timer);
  }, []);

  // ─────────────────────────────────────────────
  // DERIVED STATE
  // ─────────────────────────────────────────────
  const cycleInfo = computeCycleInfo(lmp, cycleLength);

  const phaseLabel = cycleInfo
    ? cycleInfo.dayOfCycle <= 5  ? "🩸 Menstrual"
    : cycleInfo.dayOfCycle <= 13 ? "🌱 Follicular"
    : cycleInfo.dayOfCycle <= 16 ? "🌸 Ovulation"
    : "🌙 Luteal"
    : null;

  // ─────────────────────────────────────────────
  // MOOD SETTER (also persists)
  // ─────────────────────────────────────────────
  function handleMoodSelect(emoji) {
    setMoodState(emoji);
  }

  // ─────────────────────────────────────────────
  // EMERGENCY CONTACT UPDATER
  // ─────────────────────────────────────────────
  function updateContact(index, field, value) {
    const updated = [...emergencyContacts];
    updated[index][field] = value;
    setEmergencyContacts(updated);
  }

  // ─────────────────────────────────────────────
  // CHAT — send message to AI
  // TODO: Replace fetch target with backend endpoint: POST /api/chat
  // ─────────────────────────────────────────────
  async function sendMessage() {
    if (!inputText.trim() || isLoading) return;

    const userMessage = inputText.trim();
    setInputText("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const conversationHistory = [...messages, { role: "user", content: userMessage }];

      const response = await fetch(AI_CONFIG.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model:      AI_CONFIG.model,
          max_tokens: AI_CONFIG.maxTokens,
          system:     SYSTEM_PROMPT,
          messages:   conversationHistory.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data  = await response.json();
      const reply = data.content?.[0]?.text;

      if (!reply) throw new Error("Empty response from API");

      setMessages(prev => [...prev, { role: "assistant", content: reply }]);

    } catch (err) {
      // TODO: Log error to backend monitoring (e.g. Sentry) when backend ready
      console.error("[SakhiAI] Chat error:", err);
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: `${APP_NAME} is currently unavailable. Please check your connection and try again. 💕`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  // ─────────────────────────────────────────────
  // GEOLOCATION — returns a Promise<{lat,lng}|null>
  // ─────────────────────────────────────────────
  function fetchCurrentLocation() {
    return new Promise(resolve => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        pos => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentLocation(loc);
          resolve(loc);
        },
        () => resolve(null)
      );
    });
  }

  // ─────────────────────────────────────────────
  // SOS TRIGGER
  // TODO: When backend ready, POST to /api/sos with contacts + location for server-side SMS
  // ─────────────────────────────────────────────
  async function triggerSOS() {
    setEmergencyActive(true);
    setSosSent(true);

    const loc      = await fetchCurrentLocation();
    const mapsLink = loc
      ? `https://maps.google.com/?q=${loc.lat},${loc.lng}`
      : "Location unavailable";

    const sosMessage = `🚨 EMERGENCY ALERT!\n\nI may be in danger. Please help me immediately!\n\n📍 My live location:\n${mapsLink}\n\n${SOS_SIGNATURE}`;

    const validContacts = emergencyContacts.filter(c => c.phone.trim());
    if (validContacts.length === 0) {
      alert("⚠️ Please add at least one emergency contact phone number first!");
      setSosSent(false);
      setEmergencyActive(false);
      return;
    }

    // Save SOS metadata to localStorage for display
    const timestamp = new Date().toLocaleString("en-IN");
    setLastSosTime(timestamp);
    lsSet(LS_KEYS.lastSosTimestamp, timestamp);
    if (loc) {
      setLastSosLocation(loc);
      lsSet(LS_KEYS.lastSosLocation, loc);
    }

    // Open SMS app pre-filled (browsers allow one at a time)
    const phoneNumbers = validContacts.map(c => c.phone.trim()).join(",");
    window.open(`sms:${phoneNumbers}?body=${encodeURIComponent(sosMessage)}`, "_self");

    // Open WhatsApp as backup after 1 second
    setTimeout(() => {
      const waNumber = validContacts[0].phone.replace(/\D/g, "");
      window.open(
        `https://wa.me/${waNumber}?text=${encodeURIComponent(sosMessage)}`,
        "_blank"
      );
    }, 1000);

    setTimeout(() => setSosSent(false), 6000);
  }

  // ─────────────────────────────────────────────
  // BUILD PER-CONTACT ALERT MESSAGE (with live location)
  // ─────────────────────────────────────────────
  function buildContactAlertMessage() {
    const locationText = currentLocation
      ? `https://maps.google.com/?q=${currentLocation.lat},${currentLocation.lng}`
      : "Enable location in app";
    return `🚨 EMERGENCY! I may be in danger.\n📍 Location: ${locationText}\nPlease help immediately!\n${SOS_SIGNATURE}`;
  }

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div style={{
      fontFamily: "'Georgia', serif",
      background: "linear-gradient(135deg, #fdf6fb 0%, #fce8f3 50%, #f0e8ff 100%)",
      minHeight: "100vh",
      maxWidth: 430,
      margin: "0 auto",
      position: "relative",
      overflowX: "hidden",
    }}>

      {/* ── GLOBAL STYLES ── */}
      <style>{`
        @keyframes pulse    { 0%,100%{transform:scale(1)}   50%{transform:scale(1.05)} }
        @keyframes fadeIn   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes tipSlide { 0%{opacity:0;transform:translateX(20px)} 20%,80%{opacity:1;transform:none} 100%{opacity:0;transform:translateX(-20px)} }
        .msg-bubble { animation: fadeIn 0.3s ease; }
        .tip-card   { animation: fadeIn 0.5s ease; }
        .card:hover { transform: translateY(-3px); box-shadow: 0 8px 30px rgba(194,24,91,0.2) !important; transition: all 0.2s; }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{
        background: "linear-gradient(135deg, #c2185b, #880e4f)",
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 4px 20px rgba(194,24,91,0.3)",
      }}>
        {screen !== "home" && (
          <button onClick={() => setScreen("home")} style={{
            background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8,
            color: "#fff", padding: "4px 10px", cursor: "pointer", fontSize: 18,
          }}>←</button>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ color: "#fff", fontWeight: "bold", fontSize: 20, letterSpacing: 1 }}>
            🌸 {APP_NAME}
          </div>
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 11 }}>
            {APP_TAGLINE}
          </div>
        </div>
        <button onClick={() => setScreen("emergency")} style={{
          background: "#ff1744", border: "none", borderRadius: 20,
          color: "#fff", padding: "6px 14px", cursor: "pointer",
          fontWeight: "bold", fontSize: 13,
          boxShadow: "0 2px 10px rgba(255,23,68,0.5)",
          animation: "pulse 2s infinite",
        }}>🚨 SOS</button>
      </div>

      {/* ════════════════════════════════════════
          SCREEN: HOME
      ════════════════════════════════════════ */}
      {screen === "home" && (
        <div style={{ padding: "20px 16px", paddingBottom: 80 }}>

          {/* Greeting card */}
          <div style={{
            background: "linear-gradient(135deg, #fff0f7, #f8f0ff)",
            borderRadius: 20, padding: 20, marginBottom: 16,
            boxShadow: "0 4px 20px rgba(194,24,91,0.1)",
            border: "1px solid rgba(194,24,91,0.15)",
          }}>
            <div style={{ fontSize: 26, fontWeight: "bold", color: "#880e4f" }}>
              Welcome to {APP_NAME} 🌸
            </div>
            <div style={{ color: "#ad1457", fontSize: 14, marginTop: 4 }}>
              Your trusted companion for women's health, safety and wellbeing.
            </div>

            {/* Mood selector */}
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              {["😊", "😌", "😔", "😤", "😴"].map(emoji => (
                <button key={emoji} onClick={() => handleMoodSelect(emoji)} style={{
                  fontSize: 24,
                  background: mood === emoji ? "#fce4ec" : "rgba(255,255,255,0.7)",
                  border: mood === emoji ? "2px solid #e91e63" : "2px solid transparent",
                  borderRadius: 12, padding: "6px 10px", cursor: "pointer", transition: "all 0.2s",
                }}>{emoji}</button>
              ))}
            </div>
            {mood && (
              <div style={{ color: "#c2185b", fontSize: 13, marginTop: 8 }}>
                Mood logged {mood} — taking care of yourself matters 🌸
              </div>
            )}
          </div>

          {/* Cycle phase banner OR setup prompt */}
          {cycleInfo ? (
            <div style={{
              background: "linear-gradient(135deg, #c2185b, #e91e63)",
              borderRadius: 20, padding: 18, marginBottom: 16, color: "#fff",
            }}>
              <div style={{ fontSize: 13, opacity: 0.9 }}>Current Phase</div>
              <div style={{ fontSize: 22, fontWeight: "bold" }}>{phaseLabel}</div>
              <div style={{ fontSize: 13, marginTop: 6, opacity: 0.9 }}>
                {cycleInfo.daysUntilNext > 0
                  ? `Next period in ${cycleInfo.daysUntilNext} days · ${fmtDate(cycleInfo.nextPeriod)}`
                  : "Period may have started — stay comfortable 💕"}
              </div>
              <div style={{ fontSize: 12, marginTop: 4, opacity: 0.8 }}>
                Fertile window: {fmtDate(cycleInfo.fertileStart)} – {fmtDate(cycleInfo.fertileEnd)}
              </div>
            </div>
          ) : (
            <button onClick={() => setScreen("tracker")} style={{
              width: "100%",
              background: "linear-gradient(135deg, #fce4ec, #f8bbd0)",
              border: "2px dashed #e91e63", borderRadius: 16, padding: 16,
              color: "#c2185b", fontSize: 15, cursor: "pointer", marginBottom: 16, textAlign: "center",
            }}>
              📅 Set up your cycle tracker →
            </button>
          )}

          {/* Quick action cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {QUICK_ACTIONS.map(action => (
              <button key={action.screen} className="card" onClick={() => setScreen(action.screen)} style={{
                background: "#fff", border: "1px solid rgba(194,24,91,0.15)",
                borderRadius: 16, padding: "18px 12px", cursor: "pointer",
                textAlign: "center", boxShadow: "0 2px 12px rgba(194,24,91,0.08)",
              }}>
                <div style={{ fontSize: 28 }}>{action.icon}</div>
                <div style={{ color: "#880e4f", fontWeight: "bold", fontSize: 14, marginTop: 6 }}>{action.label}</div>
              </button>
            ))}
          </div>

          {/* Rotating health tip */}
          <div key={tipIdx} className="tip-card" style={{
            background: "linear-gradient(135deg, #f3e5f5, #e8eaf6)",
            borderRadius: 16, padding: 16,
            border: "1px solid rgba(156,39,176,0.2)",
            marginBottom: 14,
          }}>
            <div style={{ fontSize: 11, color: "#7b1fa2", fontWeight: "bold", marginBottom: 6, letterSpacing: 1 }}>
              💡 DAILY TIP
            </div>
            <div style={{ fontSize: 22 }}>{HEALTH_TIPS[tipIdx].icon}</div>
            <div style={{ color: "#4a148c", fontSize: 14, marginTop: 4, lineHeight: 1.5 }}>
              {HEALTH_TIPS[tipIdx].tip}
            </div>
          </div>

          {/* About SakhiAI card */}
          <div style={{
            background: "linear-gradient(135deg, #fff0f7, #f3e5f5)",
            borderRadius: 16, padding: 16, marginBottom: 14,
            border: "1px solid rgba(194,24,91,0.15)",
            boxShadow: "0 2px 12px rgba(194,24,91,0.08)",
          }}>
            <div style={{ fontWeight: "bold", color: "#880e4f", fontSize: 15, marginBottom: 8 }}>
              🌸 About {APP_NAME}
            </div>
            <div style={{ color: "#ad1457", fontSize: 13, lineHeight: 1.6 }}>
              {APP_NAME} combines women's health guidance, cycle tracking, wellness support, emergency safety tools, and AI-powered assistance in one platform designed to support women in everyday life and emergency situations.
            </div>
          </div>

          {/* Quick helplines */}
          <div style={{
            background: "#fff3e0", borderRadius: 16, padding: 16,
            border: "1px solid rgba(255,152,0,0.3)",
          }}>
            <div style={{ fontWeight: "bold", color: "#e65100", marginBottom: 8 }}>📞 Important Helplines</div>
            {[["Women Helpline", "1091"], ["Emergency", "112"], ["Police", "100"], ["Ambulance", "108"]].map(([name, number]) => (
              <div key={number} style={{
                display: "flex", justifyContent: "space-between",
                padding: "4px 0", borderBottom: "1px solid rgba(255,152,0,0.15)",
              }}>
                <span style={{ color: "#bf360c", fontSize: 13 }}>{name}</span>
                <a href={`tel:${number}`} style={{ color: "#e65100", fontWeight: "bold", fontSize: 14, textDecoration: "none" }}>{number}</a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          SCREEN: CHAT
      ════════════════════════════════════════ */}
      {screen === "chat" && (
        <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)" }}>

          {/* Message list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px", paddingBottom: 0 }}>
            {messages.map((msg, idx) => (
              <div key={idx} className="msg-bubble" style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                marginBottom: 12,
              }}>
                {msg.role === "assistant" && (
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "linear-gradient(135deg,#c2185b,#e91e63)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginRight: 8, flexShrink: 0, fontSize: 16,
                  }}>🌸</div>
                )}
                <div style={{
                  maxWidth: "75%",
                  background: msg.role === "user"
                    ? "linear-gradient(135deg,#c2185b,#e91e63)"
                    : "#fff",
                  color: msg.role === "user" ? "#fff" : "#333",
                  borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  padding: "12px 16px", fontSize: 14, lineHeight: 1.6,
                  boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
                  whiteSpace: "pre-wrap",
                }}>{msg.content}</div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div style={{ display: "flex", gap: 8, padding: "8px 0" }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: "linear-gradient(135deg,#c2185b,#e91e63)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                }}>🌸</div>
                <div style={{
                  background: "#fff", borderRadius: 18, padding: "12px 18px",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
                }}>
                  <span style={{ color: "#c2185b" }}>●</span>
                  <span style={{ color: "#e91e63", marginLeft: 4 }}>●</span>
                  <span style={{ color: "#f48fb1", marginLeft: 4 }}>●</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick suggestion chips */}
          <div style={{ padding: "8px 16px", overflowX: "auto", display: "flex", gap: 8, flexWrap: "nowrap" }}>
            {CHAT_SUGGESTIONS.map(suggestion => (
              <button key={suggestion} onClick={() => setInputText(suggestion)} style={{
                flexShrink: 0, background: "#fce4ec", border: "1px solid #f48fb1",
                borderRadius: 20, padding: "6px 14px", fontSize: 12, color: "#c2185b",
                cursor: "pointer", whiteSpace: "nowrap",
              }}>{suggestion}</button>
            ))}
          </div>

          {/* Text input row */}
          <div style={{
            padding: 16, background: "#fff",
            borderTop: "1px solid rgba(194,24,91,0.1)",
            display: "flex", gap: 10,
          }}>
            <input
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMessage()}
              placeholder="Ask me anything about your health..."
              style={{
                flex: 1, border: "2px solid rgba(194,24,91,0.3)", borderRadius: 24,
                padding: "12px 18px", fontSize: 14, outline: "none",
                background: "#fff0f7", color: "#333", fontFamily: "Georgia, serif",
              }}
            />
            <button onClick={sendMessage} disabled={isLoading} style={{
              background: "linear-gradient(135deg,#c2185b,#e91e63)",
              border: "none", borderRadius: "50%", width: 48, height: 48,
              color: "#fff", fontSize: 20,
              cursor: isLoading ? "not-allowed" : "pointer",
              boxShadow: "0 4px 15px rgba(194,24,91,0.4)",
              opacity: isLoading ? 0.7 : 1,
            }}>➤</button>
          </div>

          {/* AI disclaimer */}
          <div style={{
            padding: "6px 16px 10px",
            background: "#fff",
            textAlign: "center",
            fontSize: 11,
            color: "#ad1457",
            borderTop: "1px solid rgba(194,24,91,0.06)",
          }}>
            ⚠️ {APP_NAME} provides educational health information only and is not a substitute for professional medical advice.
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          SCREEN: CYCLE TRACKER
      ════════════════════════════════════════ */}
      {screen === "tracker" && (
        <div style={{ padding: 20, paddingBottom: 80 }}>
          <div style={{ fontWeight: "bold", fontSize: 22, color: "#880e4f", marginBottom: 4 }}>📅 Cycle Tracker</div>
          <div style={{ color: "#ad1457", fontSize: 13, marginBottom: 20 }}>Track your cycle for personalized insights</div>

          {/* Last period date picker */}
          <div style={{
            background: "#fff", borderRadius: 20, padding: 20,
            boxShadow: "0 4px 20px rgba(194,24,91,0.1)", marginBottom: 16,
          }}>
            <label style={{ display: "block", color: "#c2185b", fontWeight: "bold", marginBottom: 6, fontSize: 14 }}>
              📆 Last Period Start Date
            </label>
            <input type="date" value={lmp} onChange={e => setLmp(e.target.value)} style={{
              width: "100%", padding: "12px 16px", borderRadius: 12,
              border: "2px solid rgba(194,24,91,0.3)",
              fontSize: 15, color: "#333", boxSizing: "border-box", background: "#fff0f7",
            }} />
          </div>

          {/* Cycle length slider */}
          <div style={{
            background: "#fff", borderRadius: 20, padding: 20,
            boxShadow: "0 4px 20px rgba(194,24,91,0.1)", marginBottom: 20,
          }}>
            <label style={{ display: "block", color: "#c2185b", fontWeight: "bold", marginBottom: 6, fontSize: 14 }}>
              🔄 Cycle Length: <span style={{ color: "#e91e63" }}>{cycleLength} days</span>
            </label>
            <input
              type="range" min={21} max={40} value={cycleLength}
              onChange={e => setCycleLength(+e.target.value)}
              style={{ width: "100%", accentColor: "#e91e63" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", color: "#aaa", fontSize: 12, marginTop: 4 }}>
              <span>21</span><span>28 (avg)</span><span>40</span>
            </div>
          </div>

          {/* Cycle prediction cards */}
          {cycleInfo && (
            <div style={{ display: "grid", gap: 12 }}>
              {[
                { label: "Next Period",    value: fmtDate(cycleInfo.nextPeriod),  icon: "🩸", color: "#fce4ec", tcolor: "#c2185b" },
                { label: "Ovulation Day",  value: fmtDate(cycleInfo.ovulation),   icon: "🥚", color: "#e8f5e9", tcolor: "#2e7d32" },
                { label: "Fertile Window", value: `${fmtDate(cycleInfo.fertileStart)} – ${fmtDate(cycleInfo.fertileEnd)}`, icon: "🌸", color: "#fff3e0", tcolor: "#e65100" },
                { label: "Current Phase",  value: phaseLabel,                      icon: "📊", color: "#f3e5f5", tcolor: "#7b1fa2" },
              ].map(({ label, value, icon, color, tcolor }) => (
                <div key={label} style={{
                  background: color, borderRadius: 16, padding: "14px 18px",
                  display: "flex", alignItems: "center", gap: 14,
                }}>
                  <span style={{ fontSize: 28 }}>{icon}</span>
                  <div>
                    <div style={{ fontSize: 11, color: tcolor, fontWeight: "bold", letterSpacing: 0.5 }}>{label.toUpperCase()}</div>
                    <div style={{ fontSize: 15, color: tcolor, fontWeight: "bold", marginTop: 2 }}>{value}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!lmp && (
            <div style={{ textAlign: "center", color: "#bbb", marginTop: 40, fontSize: 14 }}>
              🌸 Enter your last period date to see predictions
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
          SCREEN: HEALTH TIPS
      ════════════════════════════════════════ */}
      {screen === "tips" && (
        <div style={{ padding: 20, paddingBottom: 80 }}>
          <div style={{ fontWeight: "bold", fontSize: 22, color: "#880e4f", marginBottom: 4 }}>🌿 Health Tips</div>
          <div style={{ color: "#ad1457", fontSize: 13, marginBottom: 20 }}>Curated wellness advice for women</div>

          {[
            {
              cat: "Nutrition", color: "#e8f5e9", accent: "#2e7d32", icon: "🥗",
              tips: [
                "Eat iron-rich foods (spinach, dates, lentils) during your period",
                "Add flaxseeds to your diet — great for hormonal balance",
                "Reduce processed sugar to improve PCOS symptoms",
                "Calcium + Vitamin D is essential for women's bone health",
              ],
            },
            {
              cat: "Mental Wellbeing", color: "#fce4ec", accent: "#c2185b", icon: "🧘",
              tips: [
                "Track mood alongside your cycle — they're connected",
                "Journaling 5 minutes a day reduces stress hormones",
                "Limit social media during PMS week for better mood",
                "Deep breathing activates the parasympathetic nervous system",
              ],
            },
            {
              cat: "Fitness", color: "#e8eaf6", accent: "#3949ab", icon: "🏃",
              tips: [
                "Light yoga during period reduces cramp intensity",
                "Strength training boosts estrogen and bone density",
                "Walk 30 min daily — it's enough to see hormonal improvements",
                "Avoid intense workouts 2 days before your period",
              ],
            },
            {
              cat: "Sleep & Recovery", color: "#fff3e0", accent: "#e65100", icon: "😴",
              tips: [
                "Your sleep quality directly affects your cycle regularity",
                "Avoid screens 1 hour before bed for better melatonin production",
                "Sleep 7–9 hours to keep cortisol levels in check",
                "A consistent sleep schedule regulates hormones naturally",
              ],
            },
          ].map(({ cat, color, accent, icon, tips }) => (
            <div key={cat} style={{
              background: color, borderRadius: 20, padding: 18, marginBottom: 14,
              border: `1px solid ${accent}30`,
            }}>
              <div style={{ fontWeight: "bold", color: accent, fontSize: 16, marginBottom: 10 }}>{icon} {cat}</div>
              {tips.map(tip => (
                <div key={tip} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                  <span style={{ color: accent, fontSize: 16, flexShrink: 0 }}>✦</span>
                  <span style={{ color: accent, fontSize: 13, lineHeight: 1.5 }}>{tip}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ════════════════════════════════════════
          SCREEN: EMERGENCY & SAFETY
      ════════════════════════════════════════ */}
      {screen === "emergency" && (
        <div style={{ padding: 20, paddingBottom: 80 }}>
          <div style={{ fontWeight: "bold", fontSize: 22, color: "#b71c1c", marginBottom: 4 }}>🚨 Emergency & Safety</div>
          <div style={{ color: "#c62828", fontSize: 13, marginBottom: 20 }}>Quick access to safety tools</div>

          {/* SOS button */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <button onClick={triggerSOS} style={{
              width: 160, height: 160, borderRadius: "50%",
              background: emergencyActive
                ? "linear-gradient(135deg,#b71c1c,#d32f2f)"
                : "linear-gradient(135deg,#d32f2f,#f44336)",
              border: "6px solid rgba(255,255,255,0.4)",
              color: "#fff", fontSize: 28, fontWeight: "bold", cursor: "pointer",
              boxShadow: emergencyActive
                ? "0 0 0 20px rgba(244,67,54,0.2), 0 0 0 40px rgba(244,67,54,0.1)"
                : "0 8px 30px rgba(244,67,54,0.5)",
              animation: emergencyActive ? "pulse 0.8s infinite" : "none",
              transition: "all 0.3s",
            }}>
              🚨<br /><span style={{ fontSize: 18 }}>SOS</span>
            </button>

            {/* SOS feedback banner */}
            {sosSent && (
              <div style={{
                marginTop: 14, background: "#ffebee", borderRadius: 14,
                padding: "14px 18px", border: "1px solid #ef9a9a",
              }}>
                <div style={{ color: "#c62828", fontWeight: "bold", fontSize: 15 }}>🚨 SOS Triggered!</div>
                <div style={{ color: "#b71c1c", fontSize: 13, marginTop: 6, lineHeight: 1.6 }}>
                  📱 <b>SMS app opened</b> — tap Send to alert contacts<br />
                  💬 <b>WhatsApp also opened</b> as backup<br />
                  📍 Your live location is included in the message
                </div>
              </div>
            )}

            {/* Current location display */}
            {emergencyActive && currentLocation && (
              <div style={{ marginTop: 10, color: "#c62828", fontSize: 12 }}>
                📍 Location: {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}<br />
                <a
                  href={`https://maps.google.com/?q=${currentLocation.lat},${currentLocation.lng}`}
                  target="_blank" rel="noreferrer"
                  style={{ color: "#b71c1c", fontWeight: "bold" }}
                >📍 Open in Maps</a>
              </div>
            )}

            {/* Last SOS metadata */}
            {(lastSosTime || lastSosLocation) && (
              <div style={{
                marginTop: 12, background: "#fff8f8", borderRadius: 12,
                padding: "10px 14px", border: "1px solid #ffcdd2", textAlign: "left",
              }}>
                <div style={{ color: "#b71c1c", fontWeight: "bold", fontSize: 12, marginBottom: 4 }}>
                  🕐 Last SOS Activity
                </div>
                {lastSosTime && (
                  <div style={{ color: "#c62828", fontSize: 12 }}>Sent: {lastSosTime}</div>
                )}
                {lastSosLocation && (
                  <a
                    href={`https://maps.google.com/?q=${lastSosLocation.lat},${lastSosLocation.lng}`}
                    target="_blank" rel="noreferrer"
                    style={{ color: "#e53935", fontSize: 12, display: "block", marginTop: 2 }}
                  >📍 Last known location →</a>
                )}
              </div>
            )}
          </div>

          {/* Emergency contacts */}
          <div style={{
            background: "#fff", borderRadius: 20, padding: 20,
            boxShadow: "0 4px 20px rgba(244,67,54,0.1)", marginBottom: 16,
          }}>
            <div style={{ fontWeight: "bold", color: "#b71c1c", marginBottom: 6, fontSize: 16 }}>👥 Emergency Contacts</div>
            <div style={{
              fontSize: 12, color: "#e53935", marginBottom: 14,
              background: "#fff8f8", borderRadius: 8, padding: "8px 12px", border: "1px solid #ffcdd2",
            }}>
              💡 When you press SOS, your SMS app opens pre-filled with their number + your location. Just tap <b>Send</b>!
            </div>

            {emergencyContacts.map((contact, idx) => (
              <div key={idx} style={{
                marginBottom: 16, background: "#fff5f5",
                borderRadius: 14, padding: 14, border: "1px solid #ffcdd2",
              }}>
                <input
                  value={contact.name}
                  placeholder="Contact name (e.g. Mom)"
                  onChange={e => updateContact(idx, "name", e.target.value)}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 10,
                    border: "1.5px solid #ef9a9a", marginBottom: 8,
                    fontSize: 14, boxSizing: "border-box", background: "#fff",
                  }}
                />
                <input
                  value={contact.phone}
                  placeholder="+91XXXXXXXXXX"
                  onChange={e => updateContact(idx, "phone", e.target.value)}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 10,
                    border: "1.5px solid #ef9a9a", fontSize: 14,
                    background: "#fff", boxSizing: "border-box", marginBottom: 10,
                  }}
                />
                {contact.phone && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <a
                      href={`sms:${contact.phone}?body=${encodeURIComponent(buildContactAlertMessage())}`}
                      style={{
                        flex: 1, background: "linear-gradient(135deg,#1565c0,#1976d2)",
                        color: "#fff", padding: "10px 0", borderRadius: 10,
                        textAlign: "center", textDecoration: "none", fontWeight: "bold", fontSize: 13,
                      }}
                    >📱 SMS</a>
                    <a
                      href={`https://wa.me/${contact.phone.replace(/\D/g, "")}?text=${encodeURIComponent(buildContactAlertMessage())}`}
                      target="_blank" rel="noreferrer"
                      style={{
                        flex: 1, background: "linear-gradient(135deg,#1b5e20,#2e7d32)",
                        color: "#fff", padding: "10px 0", borderRadius: 10,
                        textAlign: "center", textDecoration: "none", fontWeight: "bold", fontSize: 13,
                      }}
                    >💬 WhatsApp</a>
                    <a
                      href={`tel:${contact.phone}`}
                      style={{
                        flex: 1, background: "linear-gradient(135deg,#e65100,#f4511e)",
                        color: "#fff", padding: "10px 0", borderRadius: 10,
                        textAlign: "center", textDecoration: "none", fontWeight: "bold", fontSize: 13,
                      }}
                    >📞 Call</a>
                  </div>
                )}
              </div>
            ))}

            <button
              onClick={() => setEmergencyContacts([...emergencyContacts, { name: "", phone: "" }])}
              style={{
                background: "#ffebee", border: "1.5px dashed #ef9a9a",
                borderRadius: 10, padding: "8px 16px", color: "#c62828",
                cursor: "pointer", fontSize: 13, width: "100%",
              }}
            >+ Add Another Contact</button>
          </div>

          {/* National helplines */}
          <div style={{ background: "#fff3e0", borderRadius: 20, padding: 18, border: "1px solid #ffcc80" }}>
            <div style={{ fontWeight: "bold", color: "#e65100", marginBottom: 14, fontSize: 16 }}>📞 National Helplines</div>
            {NATIONAL_HELPLINES.map(([name, number]) => (
              <div key={number} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 0", borderBottom: "1px solid rgba(255,152,0,0.2)",
              }}>
                <span style={{ color: "#bf360c", fontSize: 14 }}>{name}</span>
                <a href={`tel:${number}`} style={{
                  background: "linear-gradient(135deg,#e65100,#f4511e)",
                  color: "#fff", padding: "6px 16px", borderRadius: 20,
                  fontWeight: "bold", fontSize: 14, textDecoration: "none",
                }}>{number}</a>
              </div>
            ))}
          </div>

          {/* Nearby services (requires location) */}
          {currentLocation ? (
            <div style={{ marginTop: 14 }}>
              <a
                href={`https://www.google.com/maps/search/police+station/@${currentLocation.lat},${currentLocation.lng},15z`}
                target="_blank" rel="noreferrer"
                style={{
                  display: "block", background: "linear-gradient(135deg,#1565c0,#1976d2)",
                  color: "#fff", padding: 14, borderRadius: 14, textAlign: "center",
                  textDecoration: "none", fontWeight: "bold", marginBottom: 10,
                }}
              >🗺️ Nearby Police Stations</a>
              <a
                href={`https://www.google.com/maps/search/hospital/@${currentLocation.lat},${currentLocation.lng},15z`}
                target="_blank" rel="noreferrer"
                style={{
                  display: "block", background: "linear-gradient(135deg,#2e7d32,#388e3c)",
                  color: "#fff", padding: 14, borderRadius: 14, textAlign: "center",
                  textDecoration: "none", fontWeight: "bold",
                }}
              >🏥 Nearby Hospitals</a>
            </div>
          ) : (
            <button onClick={() => fetchCurrentLocation()} style={{
              width: "100%", marginTop: 14,
              background: "linear-gradient(135deg,#1565c0,#1976d2)",
              border: "none", borderRadius: 14, padding: 14,
              color: "#fff", fontWeight: "bold", cursor: "pointer", fontSize: 15,
            }}>📍 Enable Location for Nearby Help</button>
          )}
        </div>
      )}

      {/* ── BOTTOM NAV (home screen only) ── */}
      {screen === "home" && (
        <div style={{
          position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
          width: "100%", maxWidth: 430,
          background: "#fff", borderTop: "1px solid rgba(194,24,91,0.15)",
          display: "flex", padding: "8px 0",
          boxShadow: "0 -4px 20px rgba(194,24,91,0.1)",
        }}>
          {[
            { icon: "🏠", label: "Home",    s: "home"      },
            { icon: "📅", label: "Tracker", s: "tracker"   },
            { icon: "💬", label: "Chat",    s: "chat"      },
            { icon: "🌿", label: "Tips",    s: "tips"      },
            { icon: "🚨", label: "Safety",  s: "emergency" },
          ].map(({ icon, label, s }) => (
            <button key={s} onClick={() => setScreen(s)} style={{
              flex: 1, background: "none", border: "none", cursor: "pointer",
              padding: "6px 0", display: "flex", flexDirection: "column", alignItems: "center",
            }}>
              <span style={{ fontSize: 20 }}>{icon}</span>
              <span style={{ fontSize: 10, color: screen === s ? "#c2185b" : "#999", marginTop: 2 }}>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
