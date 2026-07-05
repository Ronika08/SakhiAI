import { useState, useEffect, useRef } from "react";
import useLocation from "./hooks/useLocation";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import StatsCards from "./components/StatsCards";
import AboutCard from "./components/AboutCard";
import HealthTips from "./components/HealthTips";

// ─────────────────────────────────────────────
// CONFIG
// TODO: Move to .env when migrating to Node.js backend
// TODO: Replace direct Anthropic calls with: fetch(`${API_BASE_URL}/api/chat`, ...)
// ─────────────────────────────────────────────
const AI_CONFIG = {
  model:      "claude-sonnet-4-20250514",
  maxTokens:  1000,
  apiUrl:     "https://api.anthropic.com/v1/messages",
};

const APP_NAME    = "SakhiAI";
const APP_TAGLINE = "Your Trusted Women's Safety & Health Companion";
const SOS_SIG     = `Sent via ${APP_NAME}`;

// ─────────────────────────────────────────────
// SYSTEM PROMPT
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
  { label: "Period Tracker", icon: "📅", screen: "tracker"   },
  { label: "AI Chat",        icon: "💬", screen: "chat"      },
  { label: "Wellness",       icon: "💪", screen: "wellness"  },
  { label: "Emergency",      icon: "🚨", screen: "emergency" },
];

const NATIONAL_HELPLINES = [
  ["🚔 Police",                "100"],
  ["🚑 Ambulance",             "108"],
  ["🆘 Emergency",             "112"],
  ["👩 Women Helpline",        "1091"],
  ["💜 Domestic Violence",     "181"],
  ["🧠 Mental Health (iCall)", "9152987821"],
];

const CHAT_SUGGESTIONS = [
  "Period cramps relief", "PCOS diet tips", "Ovulation signs", "Stress & hormones",
];

const RELATIONSHIP_OPTIONS = ["Mom", "Dad", "Sister", "Brother", "Friend", "Partner", "Aunt", "Other"];

const INITIAL_MESSAGES = [{
  role: "assistant",
  content: `Hi there 🌸 I'm ${APP_NAME}, your trusted women's safety and health companion. Ask me anything about your health, cycle, nutrition, wellbeing, or safety.`,
}];

// ─────────────────────────────────────────────
// LOCAL STORAGE HELPERS
// TODO: Replace with backend API calls when migrating to Node.js
// ─────────────────────────────────────────────
const LS = {
  mood:          "sakhi_mood",
  lmp:           "sakhi_lmp",
  cycleLength:   "sakhi_cycleLength",
  contacts:      "sakhi_contacts",
  lastSosTs:     "sakhi_lastSosTs",
  lastSosLoc:    "sakhi_lastSosLoc",
  water:         "sakhi_water",
  sleep:         "sakhi_sleep",
  moodHistory:   "sakhi_moodHistory",
  cycleHistory:  "sakhi_cycleHistory",
  wellnessLog:   "sakhi_wellnessLog",
  checkInTime:   "sakhi_checkInTime",
  checkInActive: "sakhi_checkInActive",
};

function lsGet(key, fallback) {
  try { const r = localStorage.getItem(key); return r !== null ? JSON.parse(r) : fallback; }
  catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ─────────────────────────────────────────────
// CYCLE UTILITY
// ─────────────────────────────────────────────
function computeCycleInfo(lmp, cycleLength) {
  if (!lmp) return null;
  const lmpDate    = new Date(lmp);
  const today      = new Date();
  const nextPeriod = new Date(lmpDate); nextPeriod.setDate(nextPeriod.getDate() + cycleLength);
  const ovulation  = new Date(lmpDate); ovulation.setDate(ovulation.getDate() + cycleLength - 14);
  const fertileStart = new Date(ovulation); fertileStart.setDate(fertileStart.getDate() - 5);
  const fertileEnd   = new Date(ovulation); fertileEnd.setDate(fertileEnd.getDate() + 1);
  const daysUntilNext = Math.ceil((nextPeriod - today) / 86400000);
  const dayOfCycle    = Math.ceil((today - lmpDate)    / 86400000);
  return { nextPeriod, ovulation, fertileStart, fertileEnd, daysUntilNext, dayOfCycle };
}

function fmtDate(d) {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────
// ROOT COMPONENT
// ─────────────────────────────────────────────
export default function App() {

  // ── Navigation ──
  const [screen, setScreen] = useState("home");

  // ── Chat ──
  const [messages,  setMessages]  = useState(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [voiceOn,   setVoiceOn]   = useState(false); // placeholder
  const chatEndRef = useRef(null);

  // ── Cycle tracker ──
  const [lmp,          setLmp]          = useState(() => lsGet(LS.lmp, ""));
  const [cycleLength,  setCycleLength]  = useState(() => lsGet(LS.cycleLength, 28));
  const [cycleHistory, setCycleHistory] = useState(() => lsGet(LS.cycleHistory, []));

  // ── Emergency ──
  const [contacts,       setContacts]       = useState(() => lsGet(LS.contacts, [
    { name: "", phone: "", relationship: "Mom" },
    { name: "", phone: "", relationship: "Friend" },
    { name: "", phone: "", relationship: "Other" },
  ]));
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [sosCountdown,    setSosCountdown]    = useState(null); // null | 5..0
  const [sosSent,         setSosSent]         = useState(false);
  const [lastSosTs,       setLastSosTs]       = useState(() => lsGet(LS.lastSosTs,  null));
  const [lastSosLoc,      setLastSosLoc]      = useState(() => lsGet(LS.lastSosLoc, null));
  const [currentLoc,      setCurrentLoc]      = useState(null);
  const sosTimerRef = useRef(null);
  const {
  location,
  loading: locationLoading,
  error: locationError,
  refreshLocation,
} = useLocation();

  // ── Check-In ──
  const [checkInMins,    setCheckInMins]    = useState(30);
  const [checkInActive,  setCheckInActive]  = useState(() => lsGet(LS.checkInActive, false));
  const [checkInEndTime, setCheckInEndTime] = useState(() => lsGet(LS.checkInTime, null));
  const [checkInAlert,   setCheckInAlert]   = useState(false);
  const [checkInRemain,  setCheckInRemain]  = useState(null);
  const checkInTimerRef = useRef(null);

  // ── Safe Route ──
  const [routeFrom, setRouteFrom] = useState("");
  const [routeTo,   setRouteTo]   = useState("");

  // ── Wellness ──
  const [water,        setWater]        = useState(() => lsGet(LS.water + todayKey(), 0));
  const [sleep,        setSleep]        = useState(() => lsGet(LS.sleep + todayKey(), ""));
  const [wellnessLog,  setWellnessLog]  = useState(() => lsGet(LS.wellnessLog, []));

  // ── Mood ──
  const [mood,        setMood]        = useState(() => lsGet(LS.mood, null));
  const [moodHistory, setMoodHistory] = useState(() => lsGet(LS.moodHistory, []));

  // ── UI ──
  const [tipIdx, setTipIdx] = useState(0);

  // ─────────────────────────────────────────────
  // PERSISTENCE EFFECTS
  // ─────────────────────────────────────────────
  useEffect(() => { lsSet(LS.mood,        mood);         }, [mood]);
  useEffect(() => { lsSet(LS.moodHistory, moodHistory);  }, [moodHistory]);
  useEffect(() => { lsSet(LS.lmp,         lmp);          }, [lmp]);
  useEffect(() => { lsSet(LS.cycleLength, cycleLength);  }, [cycleLength]);
  useEffect(() => { lsSet(LS.cycleHistory,cycleHistory); }, [cycleHistory]);
  useEffect(() => { lsSet(LS.contacts,    contacts);     }, [contacts]);
  useEffect(() => { lsSet(LS.wellnessLog, wellnessLog);  }, [wellnessLog]);
  useEffect(() => { lsSet(LS.water + todayKey(), water); }, [water]);
  useEffect(() => { lsSet(LS.sleep + todayKey(), sleep); }, [sleep]);

  // Chat scroll
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Tip rotation
  useEffect(() => {
    const t = setInterval(() => setTipIdx(i => (i + 1) % HEALTH_TIPS.length), 4000);
    return () => clearInterval(t);
  }, []);

  // ── Check-in countdown ──
  useEffect(() => {
    if (!checkInActive || !checkInEndTime) return;
    checkInTimerRef.current = setInterval(() => {
      const remaining = Math.ceil((new Date(checkInEndTime) - new Date()) / 1000);
      if (remaining <= 0) {
        clearInterval(checkInTimerRef.current);
        setCheckInAlert(true);
        setCheckInActive(false);
        setCheckInRemain(null);
        lsSet(LS.checkInActive, false);
      } else {
        setCheckInRemain(remaining);
      }
    }, 1000);
    return () => clearInterval(checkInTimerRef.current);
  }, [checkInActive, checkInEndTime]);

  // ── SOS countdown ──
  useEffect(() => {
    if (sosCountdown === null) return;
    if (sosCountdown === 0) { executeSOS(); return; }
    const t = setTimeout(() => setSosCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [sosCountdown]);
useEffect(() => {
  if (location) {
    setCurrentLoc(location);
  }
}, [location]);
  // ─────────────────────────────────────────────
  // DERIVED
  // ─────────────────────────────────────────────
  const cycleInfo  = computeCycleInfo(lmp, cycleLength);
  const phaseLabel = cycleInfo
    ? cycleInfo.dayOfCycle <= 5  ? "🩸 Menstrual"
    : cycleInfo.dayOfCycle <= 13 ? "🌱 Follicular"
    : cycleInfo.dayOfCycle <= 16 ? "🌸 Ovulation"
    : "🌙 Luteal"
    : null;

  // Stats for portfolio dashboard
  const stats = {
    moodLogs:       moodHistory.length,
    wellnessEntries:wellnessLog.length,
    safetyContacts: contacts.filter(c => c.phone.trim()).length,
    cycleRecords:   cycleHistory.length,
  };

  // Format check-in remaining time
  function fmtRemain(secs) {
    if (!secs) return "";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  // ─────────────────────────────────────────────
  // MOOD
  // ─────────────────────────────────────────────
  function handleMood(emoji) {
    setMood(emoji);
    const entry = { emoji, date: new Date().toLocaleString("en-IN"), dayKey: todayKey() };
    // Only log once per day
    const updated = [entry, ...moodHistory.filter(m => m.dayKey !== todayKey())].slice(0, 30);
    setMoodHistory(updated);
  }

  // ─────────────────────────────────────────────
  // WELLNESS
  // ─────────────────────────────────────────────
  function logWellness() {
    if (!sleep && water === 0) return;
    const entry = { date: todayKey(), water, sleep, mood };
    const updated = [entry, ...wellnessLog.filter(e => e.date !== todayKey())].slice(0, 60);
    setWellnessLog(updated);
    alert("✅ Wellness data saved for today!");
  }

  // ─────────────────────────────────────────────
  // CYCLE HISTORY
  // ─────────────────────────────────────────────
  function saveCycleEntry() {
    if (!lmp) return;
    const entry = { date: lmp, cycleLength, phase: phaseLabel, logged: new Date().toLocaleDateString("en-IN") };
    const updated = [entry, ...cycleHistory.filter(e => e.date !== lmp)].slice(0, 24);
    setCycleHistory(updated);
    alert("✅ Cycle entry saved!");
  }

  // ─────────────────────────────────────────────
  // CONTACTS
  // ─────────────────────────────────────────────
  function updateContact(i, field, val) {
    const updated = [...contacts]; updated[i][field] = val; setContacts(updated);
  }

  // ─────────────────────────────────────────────
  // CHECK-IN
  // ─────────────────────────────────────────────
  function startCheckIn() {
    const end = new Date(Date.now() + checkInMins * 60000).toISOString();
    setCheckInEndTime(end);
    setCheckInActive(true);
    setCheckInAlert(false);
    lsSet(LS.checkInTime,   end);
    lsSet(LS.checkInActive, true);
  }

  function confirmSafe() {
    clearInterval(checkInTimerRef.current);
    setCheckInActive(false);
    setCheckInAlert(false);
    setCheckInRemain(null);
    lsSet(LS.checkInActive, false);
  }

  // ─────────────────────────────────────────────
  // GEOLOCATION
  // ─────────────────────────────────────────────
  function fetchLoc() {
    return new Promise(resolve => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        pos => { const l = { lat: pos.coords.latitude, lng: pos.coords.longitude }; setCurrentLoc(l); resolve(l); },
        () => resolve(null)
      );
    });
  }

  // ─────────────────────────────────────────────
  // SOS — countdown then execute
  // ─────────────────────────────────────────────
  function triggerSOSCountdown() {
    setEmergencyActive(true);
    setSosCountdown(5);
  }

  function cancelSOS() {
    setSosCountdown(null);
    setEmergencyActive(false);
    clearTimeout(sosTimerRef.current);
  }

  async function executeSOS() {
    setSosCountdown(null);
    setSosSent(true);
    const loc      = await fetchLoc();
    const mapsLink = loc ? `https://maps.google.com/?q=${loc.lat},${loc.lng}` : "Location unavailable";
    const msg      = `🚨 EMERGENCY ALERT!\n\nI may be in danger. Please help me immediately!\n\n📍 My live location:\n${mapsLink}\n\n${SOS_SIG}`;
    const valid    = contacts.filter(c => c.phone.trim());
    if (!valid.length) { alert("⚠️ Add at least one emergency contact first!"); setSosSent(false); setEmergencyActive(false); return; }
    const ts = new Date().toLocaleString("en-IN");
    setLastSosTs(ts);   lsSet(LS.lastSosTs,  ts);
    if (loc) { setLastSosLoc(loc); lsSet(LS.lastSosLoc, loc); }
    window.open(`sms:${valid.map(c => c.phone).join(",")}?body=${encodeURIComponent(msg)}`, "_self");
    setTimeout(() => window.open(`https://wa.me/${valid[0].phone.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`, "_blank"), 1000);
    setTimeout(() => setSosSent(false), 6000);
  }

  function contactAlertMsg() {
    const loc = currentLoc ? `https://maps.google.com/?q=${currentLoc.lat},${currentLoc.lng}` : "Enable location in app";
    return `🚨 EMERGENCY! I may be in danger.\n📍 Location: ${loc}\nPlease help immediately!\n${SOS_SIG}`;
  }

  // ─────────────────────────────────────────────
  // CHAT
  // TODO: Replace fetch target with backend: POST /api/chat
  // ─────────────────────────────────────────────
  async function sendMessage() {
    if (!inputText.trim() || isLoading) return;
    const userMsg = inputText.trim();
    setInputText("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setIsLoading(true);
    try {
      const history = [...messages, { role: "user", content: userMsg }];
      const res  = await fetch(AI_CONFIG.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: AI_CONFIG.model, max_tokens: AI_CONFIG.maxTokens, system: SYSTEM_PROMPT,
          messages: history.map(m => ({ role: m.role, content: m.content })) }),
      });
      if (!res.ok) throw new Error(res.status);
      const data  = await res.json();
      const reply = data.content?.[0]?.text;
      if (!reply) throw new Error("empty");
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      console.error("[SakhiAI] Chat error:", err);
      setMessages(prev => [...prev, { role: "assistant", content: `${APP_NAME} is currently unavailable. Please check your connection and try again. 💕` }]);
    } finally { setIsLoading(false); }
  }

  // ─────────────────────────────────────────────
  // STYLES (shared)
  // ─────────────────────────────────────────────
  const cardStyle = {
    background: "#fff", borderRadius: 20, padding: 20,
    boxShadow: "0 4px 20px rgba(194,24,91,0.1)", marginBottom: 16,
  };
  const sectionTitle = { fontWeight: "bold", fontSize: 16, color: "#880e4f", marginBottom: 10 };
  const inputStyle = {
    width: "100%", padding: "10px 14px", borderRadius: 10,
    border: "1.5px solid rgba(194,24,91,0.3)", fontSize: 14,
    boxSizing: "border-box", background: "#fff0f7", marginBottom: 10,
  };
  const btnPrimary = {
    background: "linear-gradient(135deg,#c2185b,#e91e63)", border: "none",
    borderRadius: 12, padding: "12px 20px", color: "#fff", fontWeight: "bold",
    fontSize: 14, cursor: "pointer", width: "100%",
  };

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div style={{
      fontFamily: "'Georgia', serif",
      background: "linear-gradient(135deg,#fdf6fb 0%,#fce8f3 50%,#f0e8ff 100%)",
      minHeight: "100vh", maxWidth: 430, margin: "0 auto", position: "relative", overflowX: "hidden",
    }}>
      <style>{`
        @keyframes pulse  { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes countdown { from{stroke-dashoffset:0} to{stroke-dashoffset:157} }
        .msg-bubble{animation:fadeIn 0.3s ease}
        .tip-card{animation:fadeIn 0.5s ease}
        .card:hover{transform:translateY(-3px);box-shadow:0 8px 30px rgba(194,24,91,0.2)!important;transition:all 0.2s}
      `}</style>

      {/* ── HEADER ── */}
      <Header
  screen={screen}
  setScreen={setScreen}
  APP_NAME={APP_NAME}
  APP_TAGLINE={APP_TAGLINE}
/>
        

      {/* ── CHECK-IN ALERT BANNER ── */}
      {checkInAlert && (
        <div style={{
          background: "#b71c1c", color: "#fff", padding: "12px 20px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: 13, fontWeight: "bold" }}>⚠️ Check-in time expired! Are you safe?</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={confirmSafe} style={{
              background: "#4caf50", border: "none", borderRadius: 8,
              color: "#fff", padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: "bold",
            }}>✓ I'm Safe</button>
            <button onClick={() => { setCheckInAlert(false); setScreen("emergency"); }} style={{
              background: "#ff1744", border: "none", borderRadius: 8,
              color: "#fff", padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: "bold",
            }}>🚨 SOS</button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          SCREEN: HOME
      ════════════════════════════════════════ */}
      {screen === "home" && (
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
      )}

      {/* ════════════════════════════════════════
          SCREEN: CHAT
      ════════════════════════════════════════ */}
      {screen === "chat" && (
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
      )}

      {/* ════════════════════════════════════════
          SCREEN: CYCLE TRACKER + HISTORY
      ════════════════════════════════════════ */}
      {screen === "tracker" && (
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
      )}

      {/* ════════════════════════════════════════
          SCREEN: WELLNESS DASHBOARD
      ════════════════════════════════════════ */}
      {screen === "wellness" && (
        <div style={{ padding: 20, paddingBottom: 80 }}>
          <div style={{ fontWeight: "bold", fontSize: 22, color: "#880e4f", marginBottom: 4 }}>💪 Daily Wellness</div>
          <div style={{ color: "#ad1457", fontSize: 13, marginBottom: 20 }}>Track your daily health habits</div>

          {/* Water Intake */}
          <div style={cardStyle}>
            <div style={sectionTitle}>💧 Water Intake</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {[...Array(8)].map((_, i) => (
                <button key={i} onClick={() => setWater(i + 1)} style={{
                  fontSize: 24, background: i < water ? "#e3f2fd" : "#f5f5f5",
                  border: i < water ? "2px solid #1976d2" : "2px solid #ddd",
                  borderRadius: 10, padding: "6px 8px", cursor: "pointer", transition: "all 0.2s",
                }}>💧</button>
              ))}
            </div>
            <div style={{ color: "#1565c0", fontWeight: "bold", fontSize: 15 }}>
              {water}/8 glasses {water >= 8 ? "🎉 Goal reached!" : `— ${8 - water} more to go`}
            </div>
          </div>

          {/* Sleep Tracker */}
          <div style={cardStyle}>
            <div style={sectionTitle}>😴 Sleep Last Night</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 8 }}>
              {["<5h","5-6h","6-7h","7-8h","8-9h",">9h"].map(s => (
                <button key={s} onClick={() => setSleep(s)} style={{
                  background: sleep === s ? "linear-gradient(135deg,#c2185b,#e91e63)" : "#fce4ec",
                  border: "none", borderRadius: 10, padding: "10px 6px",
                  color: sleep === s ? "#fff" : "#c2185b",
                  fontWeight: "bold", fontSize: 13, cursor: "pointer", transition: "all 0.2s",
                }}>{s}</button>
              ))}
            </div>
            {sleep && (
              <div style={{ color: "#880e4f", fontSize: 13, marginTop: 6 }}>
                {["<5h","5-6h"].includes(sleep) ? "😴 You need more rest! Aim for 7-9 hours." : "✨ Great sleep! Your hormones thank you."}
              </div>
            )}
          </div>

          {/* Today's mood summary */}
          <div style={cardStyle}>
            <div style={sectionTitle}>😊 Today's Mood</div>
            <div style={{ display: "flex", gap: 10 }}>
              {["😊","😌","😔","😤","😴"].map(e => (
                <button key={e} onClick={() => handleMood(e)} style={{
                  fontSize: 28, background: mood === e ? "#fce4ec" : "rgba(255,255,255,0.7)",
                  border: mood === e ? "2px solid #e91e63" : "2px solid #f5f5f5",
                  borderRadius: 12, padding: "6px 10px", cursor: "pointer",
                }}>{e}</button>
              ))}
            </div>
            {mood && <div style={{ color: "#c2185b", fontSize: 13, marginTop: 8 }}>Current mood: {mood}</div>}
          </div>

          <button onClick={logWellness} style={btnPrimary}>💾 Save Today's Wellness Data</button>

          {/* Mood History */}
          {moodHistory.length > 0 && (
            <div style={{ ...cardStyle, marginTop: 16 }}>
              <div style={sectionTitle}>📊 Mood History (Last 30 days)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {moodHistory.slice(0, 14).map((m, i) => (
                  <div key={i} style={{ background: "#fce4ec", borderRadius: 10, padding: "6px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 22 }}>{m.emoji}</div>
                    <div style={{ fontSize: 10, color: "#ad1457", marginTop: 2 }}>{m.dayKey}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Wellness Log */}
          {wellnessLog.length > 0 && (
            <div style={{ ...cardStyle, marginTop: 16 }}>
              <div style={sectionTitle}>📋 Wellness Log</div>
              {wellnessLog.slice(0, 7).map((e, i) => (
                <div key={i} style={{ background: "#f0fff4", borderRadius: 10, padding: "10px 14px", marginBottom: 8 }}>
                  <div style={{ color: "#2e7d32", fontWeight: "bold", fontSize: 12 }}>{e.date}</div>
                  <div style={{ color: "#388e3c", fontSize: 13, marginTop: 4 }}>
                    💧 {e.water}/8 water · 😴 {e.sleep || "—"} sleep · Mood: {e.mood || "—"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
          SCREEN: TRUSTED CIRCLE
      ════════════════════════════════════════ */}
      {screen === "circle" && (
        <div style={{ padding: 20, paddingBottom: 80 }}>
          <div style={{ fontWeight: "bold", fontSize: 22, color: "#880e4f", marginBottom: 4 }}>👥 Trusted Circle</div>
          <div style={{ color: "#ad1457", fontSize: 13, marginBottom: 20 }}>Your 3 closest emergency contacts</div>

          {contacts.map((c, i) => (
            <div key={i} style={{ ...cardStyle, border: "1px solid rgba(194,24,91,0.15)" }}>
              <div style={{ ...sectionTitle, marginBottom: 12 }}>Contact {i + 1}</div>
              <input value={c.name} placeholder={`Name (e.g. ${["Mom","Best Friend","Sister"][i] || "Contact"})`}
                onChange={e => updateContact(i, "name", e.target.value)} style={inputStyle} />
              <input value={c.phone} placeholder="+91XXXXXXXXXX"
                onChange={e => updateContact(i, "phone", e.target.value)} style={inputStyle} />
              <select value={c.relationship} onChange={e => updateContact(i, "relationship", e.target.value)} style={{ ...inputStyle, marginBottom: 0 }}>
                {RELATIONSHIP_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {c.phone && (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <a href={`sms:${c.phone}?body=${encodeURIComponent(contactAlertMsg())}`} style={{
                    flex: 1, background: "linear-gradient(135deg,#1565c0,#1976d2)", color: "#fff",
                    padding: "10px 0", borderRadius: 10, textAlign: "center", textDecoration: "none", fontWeight: "bold", fontSize: 13,
                  }}>📱 SMS</a>
                  <a href={`https://wa.me/${c.phone.replace(/\D/g,"")}?text=${encodeURIComponent(contactAlertMsg())}`} target="_blank" rel="noreferrer" style={{
                    flex: 1, background: "linear-gradient(135deg,#1b5e20,#2e7d32)", color: "#fff",
                    padding: "10px 0", borderRadius: 10, textAlign: "center", textDecoration: "none", fontWeight: "bold", fontSize: 13,
                  }}>💬 WhatsApp</a>
                  <a href={`tel:${c.phone}`} style={{
                    flex: 1, background: "linear-gradient(135deg,#e65100,#f4511e)", color: "#fff",
                    padding: "10px 0", borderRadius: 10, textAlign: "center", textDecoration: "none", fontWeight: "bold", fontSize: 13,
                  }}>📞 Call</a>
                </div>
              )}
            </div>
          ))}
          <div style={{ background: "#e8f5e9", borderRadius: 14, padding: 14, border: "1px solid #a5d6a7", textAlign: "center" }}>
            <div style={{ color: "#2e7d32", fontSize: 13 }}>✅ Your trusted circle is saved automatically. They'll be alerted when you trigger SOS.</div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          SCREEN: SAFETY CHECK-IN
      ════════════════════════════════════════ */}
      {screen === "checkin" && (
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
      )}

      {/* ════════════════════════════════════════
          SCREEN: SAFE ROUTE
      ════════════════════════════════════════ */}
      {screen === "route" && (
        <div style={{ padding: 20, paddingBottom: 80 }}>
          <div style={{ fontWeight: "bold", fontSize: 22, color: "#880e4f", marginBottom: 4 }}>🗺️ Safe Route</div>
          <div style={{ color: "#ad1457", fontSize: 13, marginBottom: 20 }}>Plan your journey with safety in mind</div>

          <div style={cardStyle}>
            <div style={sectionTitle}>📍 Plan Your Route</div>
            <input value={routeFrom} onChange={e => setRouteFrom(e.target.value)}
              placeholder="📍 Starting point (e.g. Home, Office)"
              style={inputStyle} />
            <input value={routeTo} onChange={e => setRouteTo(e.target.value)}
              placeholder="🎯 Destination (e.g. Market, Friend's place)"
              style={{ ...inputStyle, marginBottom: 0 }} />
            <button style={{ ...btnPrimary, marginTop: 14, opacity: 0.7 }} onClick={() => alert("🗺️ Google Maps integration coming soon!\n\nThis will show safer routes, lit paths, and avoid unsafe areas.")}>
              🗺️ Find Safe Route (Coming Soon)
            </button>
          </div>

          {/* Placeholder map area */}
          <div style={{
            background: "linear-gradient(135deg,#e8eaf6,#f3e5f5)", borderRadius: 20, padding: 40,
            textAlign: "center", border: "2px dashed #9fa8da", marginBottom: 16,
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
            <div style={{ color: "#3949ab", fontWeight: "bold", fontSize: 16, marginBottom: 8 }}>
              Safe Route Map
            </div>
            <div style={{ color: "#5c6bc0", fontSize: 13, lineHeight: 1.6 }}>
              Google Maps integration coming soon.<br/>
              Will show safer, well-lit routes and avoid unsafe areas.
            </div>
          </div>

          {/* Quick share location */}
          <div style={cardStyle}>
            <div style={sectionTitle}>📡 Share Live Location</div>
            <div style={{ color: "#ad1457", fontSize: 13, marginBottom: 12, lineHeight: 1.6 }}>
              Share your real-time location with your Trusted Circle while travelling.
            </div>
            <button onClick={async () => {
              const loc = await fetchLoc();
              if (loc) {
                const msg = `📍 I'm sharing my location:\nhttps://maps.google.com/?q=${loc.lat},${loc.lng}\n— ${APP_NAME}`;
                const valid = contacts.filter(c => c.phone.trim());
                if (valid.length) window.open(`https://wa.me/${valid[0].phone.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`, "_blank");
                else alert("Add contacts in Trusted Circle first!");
              } else {
                alert("Location permission required. Please enable it in your browser.");
              }
            }} style={btnPrimary}>📡 Share My Location Now</button>
          </div>

          <div style={{ background: "#e8f5e9", borderRadius: 14, padding: 14, border: "1px solid #a5d6a7" }}>
            <div style={{ fontWeight: "bold", color: "#2e7d32", fontSize: 13, marginBottom: 6 }}>🔮 Coming Soon</div>
            <div style={{ color: "#388e3c", fontSize: 12, lineHeight: 1.7 }}>
              ✦ Google Maps safer route suggestions<br/>
              ✦ Avoid poorly lit or high-crime areas<br/>
              ✦ Live location sharing with trusted contacts<br/>
              ✦ Estimated arrival time alerts
            </div>
          </div>
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
            { cat: "Nutrition",        color: "#e8f5e9", accent: "#2e7d32", icon: "🥗",
              tips: ["Eat iron-rich foods (spinach, dates, lentils) during your period","Add flaxseeds to your diet — great for hormonal balance","Reduce processed sugar to improve PCOS symptoms","Calcium + Vitamin D is essential for women's bone health"] },
            { cat: "Mental Wellbeing", color: "#fce4ec", accent: "#c2185b", icon: "🧘",
              tips: ["Track mood alongside your cycle — they're connected","Journaling 5 minutes a day reduces stress hormones","Limit social media during PMS week for better mood","Deep breathing activates the parasympathetic nervous system"] },
            { cat: "Fitness",          color: "#e8eaf6", accent: "#3949ab", icon: "🏃",
              tips: ["Light yoga during period reduces cramp intensity","Strength training boosts estrogen and bone density","Walk 30 min daily — it's enough to see hormonal improvements","Avoid intense workouts 2 days before your period"] },
            { cat: "Sleep & Recovery", color: "#fff3e0", accent: "#e65100", icon: "😴",
              tips: ["Your sleep quality directly affects your cycle regularity","Avoid screens 1 hour before bed for better melatonin production","Sleep 7–9 hours to keep cortisol levels in check","A consistent sleep schedule regulates hormones naturally"] },
          ].map(({ cat, color, accent, icon, tips }) => (
            <div key={cat} style={{ background: color, borderRadius: 20, padding: 18, marginBottom: 14, border: `1px solid ${accent}30` }}>
              <div style={{ fontWeight: "bold", color: accent, fontSize: 16, marginBottom: 10 }}>{icon} {cat}</div>
              {tips.map(t => (
                <div key={t} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                  <span style={{ color: accent, fontSize: 16, flexShrink: 0 }}>✦</span>
                  <span style={{ color: accent, fontSize: 13, lineHeight: 1.5 }}>{t}</span>
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

          {/* SOS with countdown */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            {sosCountdown !== null ? (
              /* COUNTDOWN UI */
              <div>
                <div style={{ position: "relative", display: "inline-block", marginBottom: 16 }}>
                  <svg width="180" height="180" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="90" cy="90" r="80" fill="none" stroke="#ffcdd2" strokeWidth="10" />
                    <circle cx="90" cy="90" r="80" fill="none" stroke="#f44336" strokeWidth="10"
                      strokeDasharray="503"
                      strokeDashoffset={503 - (503 * (5 - sosCountdown) / 5)}
                      style={{ transition: "stroke-dashoffset 1s linear" }} />
                  </svg>
                  <div style={{
                    position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
                    textAlign: "center",
                  }}>
                    <div style={{ fontSize: 56, fontWeight: "bold", color: "#b71c1c", lineHeight: 1 }}>{sosCountdown}</div>
                    <div style={{ fontSize: 13, color: "#c62828", marginTop: 4 }}>SOS sending...</div>
                  </div>
                </div>
                <br />
                <button onClick={cancelSOS} style={{
                  background: "#fff", border: "2px solid #e53935", borderRadius: 24,
                  color: "#c62828", padding: "12px 36px", fontSize: 16, fontWeight: "bold",
                  cursor: "pointer", boxShadow: "0 4px 15px rgba(244,67,54,0.2)",
                }}>✕ Cancel SOS</button>
              </div>
            ) : (
              /* NORMAL SOS BUTTON */
              <button onClick={triggerSOSCountdown} style={{
                width: 160, height: 160, borderRadius: "50%",
                background: emergencyActive ? "linear-gradient(135deg,#b71c1c,#d32f2f)" : "linear-gradient(135deg,#d32f2f,#f44336)",
                border: "6px solid rgba(255,255,255,0.4)",
                color: "#fff", fontSize: 28, fontWeight: "bold", cursor: "pointer",
                boxShadow: "0 8px 30px rgba(244,67,54,0.5)",
                animation: "pulse 2s infinite", transition: "all 0.3s",
              }}>
                🚨<br /><span style={{ fontSize: 18 }}>SOS</span>
              </button>
            )}

            {/* SOS sent confirmation */}
            {sosSent && (
              <div style={{ marginTop: 14, background: "#ffebee", borderRadius: 14, padding: "14px 18px", border: "1px solid #ef9a9a" }}>
                <div style={{ color: "#c62828", fontWeight: "bold", fontSize: 15 }}>🚨 SOS Triggered!</div>
                <div style={{ color: "#b71c1c", fontSize: 13, marginTop: 6, lineHeight: 1.6 }}>
                  📱 <b>SMS app opened</b> — tap Send to alert contacts<br />
                  💬 <b>WhatsApp also opened</b> as backup<br />
                  📍 Your live location is included
                </div>
              </div>
            )}

            {/* Location display */}
            {currentLoc && (
              <div style={{ marginTop: 10, color: "#c62828", fontSize: 12 }}>
                📍 {currentLoc.lat.toFixed(4)}, {currentLoc.lng.toFixed(4)} · <a href={`https://maps.google.com/?q=${currentLoc.lat},${currentLoc.lng}`} target="_blank" rel="noreferrer" style={{ color: "#b71c1c", fontWeight: "bold" }}>Open Maps</a>
              </div>
            )}

            {/* Last SOS info */}
            {(lastSosTs || lastSosLoc) && (
              <div style={{ marginTop: 12, background: "#fff8f8", borderRadius: 12, padding: "10px 14px", border: "1px solid #ffcdd2", textAlign: "left" }}>
                <div style={{ color: "#b71c1c", fontWeight: "bold", fontSize: 12, marginBottom: 4 }}>🕐 Last SOS</div>
                {lastSosTs  && <div style={{ color: "#c62828", fontSize: 12 }}>{lastSosTs}</div>}
                {lastSosLoc && <a href={`https://maps.google.com/?q=${lastSosLoc.lat},${lastSosLoc.lng}`} target="_blank" rel="noreferrer" style={{ color: "#e53935", fontSize: 12 }}>📍 Last known location →</a>}
              </div>
            )}
          </div>

          {/* Emergency Contacts (quick view) */}
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <div style={{ fontWeight: "bold", color: "#b71c1c", marginBottom: 6, fontSize: 16 }}>👥 Emergency Contacts</div>
            <div style={{ fontSize: 12, color: "#e53935", marginBottom: 12, background: "#fff8f8", borderRadius: 8, padding: "8px 12px", border: "1px solid #ffcdd2" }}>
              💡 SMS app opens pre-filled with your number + location. Just tap <b>Send</b>!
            </div>
            {contacts.map((c, i) => c.phone ? (
              <div key={i} style={{ background: "#fff5f5", borderRadius: 12, padding: "10px 14px", marginBottom: 10, border: "1px solid #ffcdd2" }}>
                <div style={{ color: "#b71c1c", fontWeight: "bold", fontSize: 14, marginBottom: 8 }}>
                  {c.name || `Contact ${i+1}`} <span style={{ color: "#e53935", fontWeight: "normal", fontSize: 12 }}>({c.relationship})</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <a href={`sms:${c.phone}?body=${encodeURIComponent(contactAlertMsg())}`} style={{ flex:1, background:"linear-gradient(135deg,#1565c0,#1976d2)", color:"#fff", padding:"8px 0", borderRadius:10, textAlign:"center", textDecoration:"none", fontWeight:"bold", fontSize:12 }}>📱 SMS</a>
                  <a href={`https://wa.me/${c.phone.replace(/\D/g,"")}?text=${encodeURIComponent(contactAlertMsg())}`} target="_blank" rel="noreferrer" style={{ flex:1, background:"linear-gradient(135deg,#1b5e20,#2e7d32)", color:"#fff", padding:"8px 0", borderRadius:10, textAlign:"center", textDecoration:"none", fontWeight:"bold", fontSize:12 }}>💬 WA</a>
                  <a href={`tel:${c.phone}`} style={{ flex:1, background:"linear-gradient(135deg,#e65100,#f4511e)", color:"#fff", padding:"8px 0", borderRadius:10, textAlign:"center", textDecoration:"none", fontWeight:"bold", fontSize:12 }}>📞 Call</a>
                </div>
              </div>
            ) : null)}
            <button onClick={() => setScreen("circle")} style={{ ...btnPrimary, background: "linear-gradient(135deg,#880e4f,#c2185b)", marginTop: 4 }}>
              👥 Manage Trusted Circle
            </button>
          </div>

          {/* National Helplines */}
          <div style={{ background: "#fff3e0", borderRadius: 20, padding: 18, border: "1px solid #ffcc80", marginBottom: 14 }}>
            <div style={{ fontWeight: "bold", color: "#e65100", marginBottom: 14, fontSize: 16 }}>📞 National Helplines</div>
            {NATIONAL_HELPLINES.map(([name, num]) => (
              <div key={num} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,152,0,0.2)" }}>
                <span style={{ color: "#bf360c", fontSize: 14 }}>{name}</span>
                <a href={`tel:${num}`} style={{ background: "linear-gradient(135deg,#e65100,#f4511e)", color: "#fff", padding: "6px 16px", borderRadius: 20, fontWeight: "bold", fontSize: 14, textDecoration: "none" }}>{num}</a>
              </div>
            ))}
          </div>

          {/* Nearby services */}
          {currentLoc ? (
            <div>
              <a href={`https://www.google.com/maps/search/police+station/@${currentLoc.lat},${currentLoc.lng},15z`} target="_blank" rel="noreferrer"
                style={{ display:"block", background:"linear-gradient(135deg,#1565c0,#1976d2)", color:"#fff", padding:14, borderRadius:14, textAlign:"center", textDecoration:"none", fontWeight:"bold", marginBottom:10 }}>🗺️ Nearby Police Stations</a>
              <a href={`https://www.google.com/maps/search/hospital/@${currentLoc.lat},${currentLoc.lng},15z`} target="_blank" rel="noreferrer"
                style={{ display:"block", background:"linear-gradient(135deg,#2e7d32,#388e3c)", color:"#fff", padding:14, borderRadius:14, textAlign:"center", textDecoration:"none", fontWeight:"bold" }}>🏥 Nearby Hospitals</a>
            </div>
          ) : (
            <button onClick={() => fetchLoc()} style={btnPrimary}>📍 Enable Location for Nearby Help</button>
          )}
        </div>
      )}

      {/* ── BOTTOM NAV ── */}
      {screen === "home" && (
        <div style={{
          position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
          width: "100%", maxWidth: 430, background: "#fff",
          borderTop: "1px solid rgba(194,24,91,0.15)",
          display: "flex", padding: "8px 0",
          boxShadow: "0 -4px 20px rgba(194,24,91,0.1)",
        }}>
          {[
            { icon: "🏠", label: "Home",    s: "home"      },
            { icon: "📅", label: "Tracker", s: "tracker"   },
            { icon: "💬", label: "Chat",    s: "chat"      },
            { icon: "💪", label: "Wellness",s: "wellness"  },
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
