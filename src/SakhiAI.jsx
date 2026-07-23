import { useState, useEffect, useRef } from "react";
import useLocation from "./hooks/useLocation";
import Header from "./components/Header";
import { getAddressFromCoordinates } from "./services/locationService";

import HomePage from "./pages/HomePage";
import ChatPage from "./pages/ChatPage";
import TrackerPage from "./pages/TrackerPage";
import WellnessPage from "./pages/WellnessPage";
import EmergencyPage from "./pages/EmergencyPage";
import TrustedCirclePage from "./pages/TrustedCirclePage";
import SafeRoutePage from "./pages/SafeRoutePage";
import CheckInPage from "./pages/CheckInPage";
import TipsPage from "./pages/TipsPage";

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
  const [currentAddress,  setCurrentAddress]  = useState(null);
  const sosTimerRef = useRef(null);
  const {
  location,
  gpsStatus,
  lastUpdated,
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
  async function fetchLoc() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };

        setCurrentLoc(location);

        try {
          const address = await getAddressFromCoordinates(
            location.lat,
            location.lng
          );

          setCurrentAddress(address);
        } catch (err) {
          console.error(err);
        }

        resolve(location);
      },
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
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
        <HomePage
          APP_NAME={APP_NAME}
          mood={mood}
          handleMood={handleMood}
          stats={stats}
          cycleInfo={cycleInfo}
          phaseLabel={phaseLabel}
          fmtDate={fmtDate}
          setScreen={setScreen}
          QUICK_ACTIONS={QUICK_ACTIONS}
          tipIdx={tipIdx}
          HEALTH_TIPS={HEALTH_TIPS}
          cardStyle={cardStyle}
        />
      )}

      {/* ════════════════════════════════════════
          SCREEN: CHAT
      ════════════════════════════════════════ */}
      {screen === "chat" && (
        <ChatPage
          messages={messages}
          isLoading={isLoading}
          chatEndRef={chatEndRef}
          CHAT_SUGGESTIONS={CHAT_SUGGESTIONS}
          inputText={inputText}
          setInputText={setInputText}
          sendMessage={sendMessage}
          voiceOn={voiceOn}
          setVoiceOn={setVoiceOn}
          APP_NAME={APP_NAME}
        />
      )}

      {/* ════════════════════════════════════════
          SCREEN: CYCLE TRACKER + HISTORY
      ════════════════════════════════════════ */}
      {screen === "tracker" && (
        <TrackerPage
          cardStyle={cardStyle}
          inputStyle={inputStyle}
          sectionTitle={sectionTitle}
          btnPrimary={btnPrimary}
          lmp={lmp}
          setLmp={setLmp}
          cycleLength={cycleLength}
          setCycleLength={setCycleLength}
          cycleInfo={cycleInfo}
          phaseLabel={phaseLabel}
          fmtDate={fmtDate}
          saveCycleEntry={saveCycleEntry}
          cycleHistory={cycleHistory}
        />
      )}

      {/* ════════════════════════════════════════
          SCREEN: WELLNESS DASHBOARD
      ════════════════════════════════════════ */}
      {screen === "wellness" && (
        <WellnessPage
          cardStyle={cardStyle}
          sectionTitle={sectionTitle}
          btnPrimary={btnPrimary}
          water={water}
          setWater={setWater}
          sleep={sleep}
          setSleep={setSleep}
          mood={mood}
          handleMood={handleMood}
          logWellness={logWellness}
          moodHistory={moodHistory}
          wellnessLog={wellnessLog}
        />
      )}

      {/* ════════════════════════════════════════
          SCREEN: TRUSTED CIRCLE
      ════════════════════════════════════════ */}
      {screen === "circle" && (
        <TrustedCirclePage
          cardStyle={cardStyle}
          sectionTitle={sectionTitle}
          inputStyle={inputStyle}
          contacts={contacts}
          updateContact={updateContact}
          RELATIONSHIP_OPTIONS={RELATIONSHIP_OPTIONS}
          contactAlertMsg={contactAlertMsg}
        />
      )}

      {/* ════════════════════════════════════════
          SCREEN: SAFETY CHECK-IN
      ════════════════════════════════════════ */}
      {screen === "checkin" && (
        <CheckInPage
          cardStyle={cardStyle}
          sectionTitle={sectionTitle}
          btnPrimary={btnPrimary}
          checkInMins={checkInMins}
          setCheckInMins={setCheckInMins}
          checkInActive={checkInActive}
          startCheckIn={startCheckIn}
          checkInRemain={checkInRemain}
          confirmSafe={confirmSafe}
          fmtRemain={fmtRemain}
        />
      )}

      {/* ════════════════════════════════════════
          SCREEN: SAFE ROUTE
      ════════════════════════════════════════ */}
      {screen === "route" && (
        <SafeRoutePage
          cardStyle={cardStyle}
          sectionTitle={sectionTitle}
          inputStyle={inputStyle}
          btnPrimary={btnPrimary}
          routeFrom={routeFrom}
          setRouteFrom={setRouteFrom}
          routeTo={routeTo}
          setRouteTo={setRouteTo}
          fetchLoc={fetchLoc}
          contacts={contacts}
          APP_NAME={APP_NAME}
        />
      )}

      {/* ════════════════════════════════════════
          SCREEN: HEALTH TIPS
      ════════════════════════════════════════ */}
      {screen === "tips" && (
        <TipsPage />
      )}

      {/* ════════════════════════════════════════
          SCREEN: EMERGENCY & SAFETY
      ════════════════════════════════════════ */}
      {screen === "emergency" && (
        <EmergencyPage
          sosCountdown={sosCountdown}
          emergencyActive={emergencyActive}
          triggerSOSCountdown={triggerSOSCountdown}
          cancelSOS={cancelSOS}
          sosSent={sosSent}
          currentLoc={currentLoc}
          gpsStatus={gpsStatus}
          lastUpdated={lastUpdated}
          refreshLocation={refreshLocation}
          lastSosTs={lastSosTs}
          lastSosLoc={lastSosLoc}
          contacts={contacts}
          setScreen={setScreen}
          contactAlertMsg={contactAlertMsg}
          NATIONAL_HELPLINES={NATIONAL_HELPLINES}
          fetchLoc={fetchLoc}
          cardStyle={cardStyle}
          btnPrimary={btnPrimary}
        />
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
