import { useState, useEffect, useRef } from "react";
import useLocation from "./hooks/useLocation";
import Header from "./components/Header";
import { getAddressFromCoordinates, getPreciseLocation } from "./services/locationService";
import { useAuth } from "./context/AuthContext";
import { useToast } from "./components/Toast";
import ConfirmDialog from "./components/ConfirmDialog";
import AuthPage from "./pages/AuthPage";
import { contactsApi, cycleApi, moodApi, wellnessApi, sosApi } from "./services/dataApi";
import { routeChat } from "./services/chatRouter";
import { speak, stopSpeaking } from "./services/tts";
import { useLanguage } from "./i18n/LanguageContext";
import { useConnectivity, useSyncStatus } from "./hooks/useConnectivity";
import useVoiceInput from "./hooks/useVoiceInput";
import ConnectivityPanel from "./components/ConnectivityPanel";
import LanguageSelector from "./components/LanguageSelector";
import { startConnectivityMonitor } from "./services/connectivity";
import {
  submit as submitChange, flush as flushOutbox, enqueue, removeByKey, startSyncEngine,
  onOpResult, onOutboxChange, getOutboxSummary,
} from "./services/syncQueue";
import { registerSyncHandlers } from "./services/syncHandlers";

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
// The AI provider, model, API key and system prompt are owned by the BACKEND
// (backend/.env). Nothing secret or model-related lives in the frontend.
// API base URL: see services/apiClient.js (VITE_API_BASE_URL).
// ─────────────────────────────────────────────
const APP_NAME    = "SakhiAI";
const APP_TAGLINE = "Your Trusted Women's Safety & Health Companion";
const SOS_SIG     = `Sent via ${APP_NAME}`;

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
  checkInId:     "sakhi_checkInId",
  activity:      "sakhi_activity",
  stress:        "sakhi_stress",
  migrated:      "sakhi_migrated_",
  sosLocal:      "sakhi_sosLocal",
};

function lsGet(key, fallback) {
  try { const r = localStorage.getItem(key); return r !== null ? JSON.parse(r) : fallback; }
  catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
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

/** Stable random id for this browser; used to build idempotency keys for offline sync. */
function deviceId() {
  try {
    let id = localStorage.getItem("sakhi_device");
    if (!id) { id = Math.random().toString(36).slice(2, 10); localStorage.setItem("sakhi_device", id); }
    return id;
  } catch { return "dev00000"; }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────
// ROOT COMPONENT
// ─────────────────────────────────────────────
export default function App() {

  // ── Navigation ──
  const [screen, setScreen] = useState(() => {
    try {
      const s = new URLSearchParams(window.location.search).get("screen");
      return ["emergency", "chat", "tracker", "wellness", "circle", "checkin", "route", "tips", "account"].includes(s) ? s : "home";
    } catch { return "home"; }
  });

  // ── Chat ──
  const [messages,  setMessages]  = useState(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [voiceOn,   setVoiceOn]   = useState(false); // read replies aloud (device speech synthesis)
  const chatEndRef = useRef(null);
  const { lang, t } = useLanguage();
  const connectivity = useConnectivity();
  const online = connectivity === "online";
  useSyncStatus();
  const voice = useVoiceInput({ lang, online, onTranscript: (text) => setInputText(text) });
  const chatSuggestions = [t("chat.suggest1"), t("chat.suggest2"), t("chat.suggest3"), t("chat.suggest4")];

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
  // eslint-disable-next-line no-unused-vars
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

  // ── Account / sync / SOS report / dialogs ──
  const { isAuthenticated, user, status: authStatus } = useAuth();
  const sosPayloadRef = useRef(null);
  const toast = useToast();
  const [sync, setSync] = useState({ loading: false, error: null });
  const [sosReport, setSosReport] = useState(null);
  const [justReconnected, setJustReconnected] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [locError, setLocError] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [resetToken, setResetToken] = useState(() => {
    try { return new URLSearchParams(window.location.search).get("reset"); } catch { return null; }
  });
  const sosEventIdRef = useRef(null);
  const sosLocRef = useRef(null);
  const checkInIdRef = useRef(lsGet(LS.checkInId, null));
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [cyclePrediction, setCyclePrediction] = useState(null);

  // ── Extra wellness fields (activity / stress) ──
  const [activity, setActivity] = useState(() => lsGet(LS.activity + todayKey(), ""));
  const [stress,   setStress]   = useState(() => lsGet(LS.stress + todayKey(), ""));

  // ── Cycle entry details ──
  const [cycleFlow,     setCycleFlow]     = useState("");
  const [cycleSymptoms, setCycleSymptoms] = useState([]);
  const [cycleNotes,    setCycleNotes]    = useState("");

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
  useEffect(() => { lsSet(LS.activity + todayKey(), activity); }, [activity]);
  useEffect(() => { lsSet(LS.stress + todayKey(), stress); }, [stress]);

  // ─────────────────────────────────────────────
  // OFFLINE-FIRST SYNC (signed-in users; anonymous users stay on localStorage)
  //   local change → outbox → (online + signed in) → API → MongoDB
  // ─────────────────────────────────────────────
  const isAuthedRef = useRef(false);
  useEffect(() => { isAuthedRef.current = isAuthenticated; }, [isAuthenticated]);
  const needsPullRef = useRef(false);

  useEffect(() => { registerSyncHandlers(); }, []);
  useEffect(() => startConnectivityMonitor(), []);
  useEffect(() => startSyncEngine({ isAuthed: () => isAuthedRef.current }), []);

  // Results of queued operations (immediate or after reconnecting).
  useEffect(() => onOpResult((evt) => {
    const { op } = evt;
    if (evt.ok) {
      if (op.type === "sos.create") {
        const { sosEvent, delivery } = evt.result;
        setSosReport({
          phase: "done", event: sosEvent, delivery,
          locationNote: sosLocRef.current ? null : "GPS was unavailable, so no location was included.",
          late: Boolean(sosEvent?.syncedLate),
        });
        updateLocalSOS(op.payload.clientEventId, delivery.notificationStatus);
      } else if (op.type === "cycle.save" && evt.result?.log?._id) {
        setCycleHistory(h => h.map(e => (e.date === op.payload.date ? { ...e, id: evt.result.log._id } : e)));
      } else if (op.type === "contacts.sync" && evt.result?.slots) {
        setContacts(evt.result.slots);
      } else if (op.type === "checkin.start" && evt.result?.checkIn?._id) {
        checkInIdRef.current = evt.result.checkIn._id; lsSet(LS.checkInId, evt.result.checkIn._id);
      }
      return;
    }
    if (op.type === "sos.create") {
      updateLocalSOS(op.payload.clientEventId, evt.permanent ? "FAILED" : "RETRYING");
      setSosReport(prev => (prev && prev.phase === "done") ? prev : { phase: evt.permanent ? "error" : "queued", retrying: !evt.permanent, message: evt.error?.userMessage });
    } else if (evt.permanent) {
      toast.error(evt.error?.userMessage || "A change could not be synced.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  // Pull server data (server wins) only when nothing local is waiting to be pushed.
  async function pullFromServer() {
    const [c, cy, m, w] = await Promise.allSettled([contactsApi.list(), cycleApi.list(), moodApi.list(), wellnessApi.list()]);
    const failed = [c, cy, m, w].filter((r) => r.status === "rejected");

    if (c.status === "fulfilled" && c.value.length > 0) {
      const mapped = c.value.map(contactsApi.toFrontend);
      while (mapped.length < 3) mapped.push({ name: "", phone: "", email: "", relationship: "Other" });
      setContacts(mapped);
    }
    if (cy.status === "fulfilled" && cy.value.length > 0) {
      setCycleHistory(cy.value.map(cycleApi.toFrontend).map((e) => ({ ...e, phase: e.phase || "—" })).slice(0, 24));
      const latest = cy.value[0];
      if (latest?.startDate) { setLmp(new Date(latest.startDate).toISOString().slice(0, 10)); if (latest.cycleLengthDays) setCycleLength(latest.cycleLengthDays); }
    }
    if (m.status === "fulfilled" && m.value.length > 0) {
      const seen = new Set();
      const mapped = m.value.map(moodApi.toFrontend).filter((e) => (seen.has(e.dayKey) ? false : seen.add(e.dayKey)));
      setMoodHistory(mapped.slice(0, 30));
      if (mapped[0]?.dayKey === todayKey()) setMood(mapped[0].emoji);
    }
    if (w.status === "fulfilled" && w.value.length > 0) {
      const mapped = w.value.map(wellnessApi.toFrontend);
      setWellnessLog(mapped.slice(0, 60));
      const today = mapped.find((e) => e.date === todayKey());
      if (today) { setWater(today.water); if (today.sleep) setSleep(today.sleep); setActivity(today.activity); setStress(today.stress); }
    }
    wellnessApi.summary(7).then(setWeeklySummary).catch(() => {});
    cycleApi.predict().then(setCyclePrediction).catch(() => {});
    setSync({ loading: false, error: failed.length ? (failed[0].reason?.userMessage || "Some data could not be synced.") : null });
    return failed.length === 0;
  }

  useEffect(() => {
    if (!isAuthenticated || !user) return undefined;
    let cancelled = false;
    (async () => {
      setSync({ loading: true, error: null });
      // One-time upload of data created before sign-in. Stable client ids make this idempotent.
      if (!lsGet(LS.migrated + user.id, false)) {
        const dev = deviceId();
        if (contacts.some((x) => x.name?.trim() && x.phone?.trim())) enqueue("contacts.sync", {}, { key: "contacts" });
        cycleHistory.forEach((e) => enqueue("cycle.save", { date: e.date, cycleLength: e.cycleLength, clientId: `mig-${dev}-${e.date}` }, { key: `cycle:${e.date}` }));
        wellnessLog.forEach((e) => enqueue("wellness.save", { date: e.date, water: e.water, sleep: e.sleep, mood: e.mood }, { key: `wellness:${e.date}` }));
        if (mood) enqueue("mood.save", { emoji: mood, clientId: `mig-${dev}-${todayKey()}`, loggedDate: new Date().toISOString() }, { key: `mood:${todayKey()}` });
        lsSet(LS.migrated + user.id, true);
      }
      await flushOutbox({ isAuthed: () => isAuthedRef.current });
      if (cancelled) return;
      if (getOutboxSummary().pending === 0) { needsPullRef.current = false; await pullFromServer(); }
      else { needsPullRef.current = true; setSync({ loading: false, error: null }); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  // When the queue drains after being blocked (e.g. connectivity returned), pull fresh server data.
  useEffect(() => onOutboxChange((s) => {
    if (s.pending === 0 && needsPullRef.current && isAuthedRef.current) { needsPullRef.current = false; pullFromServer(); }
  }), []);

  /** Queue a change for the account. Anonymous users: localStorage only (nothing queued). */
  async function queueSync(type, payload, opts = {}) {
    if (!isAuthenticated) return { status: "local" };
    return submitChange(type, payload, { ...opts, isAuthed: () => isAuthedRef.current });
  }
  function syncStatusText() {
    const p = getOutboxSummary().pending;
    return p > 0 ? ` · ${t("sync.syncing")}` : "";
  }
  function reportSaved(result, okText) {
    if (result.status === "done") toast.success(okText);
    else if (result.status === "queued") toast.info(t("sync.offline.saved"));
    else if (result.status === "failed") toast.error(`${result.error?.userMessage || "Could not sync."}`);
    else toast.success(okText);
  }

  // Keep a small local record of SOS events (visible even with no network / no account).
  function updateLocalSOS(clientEventId, status) {
    const list = lsGet(LS.sosLocal, []);
    lsSet(LS.sosLocal, list.map((e) => (e.clientEventId === clientEventId ? { ...e, status } : e)));
  }

  // Greeting follows the selected language until the conversation starts.
  useEffect(() => {
    setMessages(prev => (prev.length === 1 && prev[0].role === "assistant" ? [{ role: "assistant", content: t("chat.initial", { app: APP_NAME }) }] : prev));
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop reading aloud when leaving the chat or turning it off.
  useEffect(() => { if (!voiceOn || screen !== "chat") stopSpeaking(); }, [voiceOn, screen]);

  // Announce reconnection briefly.
  const prevOnline = useRef(online);
  useEffect(() => {
    if (online && !prevOnline.current) { setJustReconnected(true); setTimeout(() => setJustReconnected(false), 5000); }
    prevOnline.current = online;
  }, [online]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    queueSync("mood.save", { emoji, clientId: `mood-${deviceId()}-${Date.now().toString(36)}`, loggedDate: new Date().toISOString() }, { key: `mood:${todayKey()}` })
      .then((r) => { if (r.status === "queued") toast.info(t("sync.offline.saved")); else if (r.status === "failed") toast.error(r.error?.userMessage || "Could not sync mood."); });
  }

  // ─────────────────────────────────────────────
  // WELLNESS
  // ─────────────────────────────────────────────
  async function logWellness() {
    if (!sleep && water === 0 && activity === "" && stress === "") {
      toast.info("Add water, sleep, activity or stress first.");
      return;
    }
    const entry = { date: todayKey(), water, sleep, mood, activity, stress };
    const updated = [entry, ...wellnessLog.filter(e => e.date !== todayKey())].slice(0, 60);
    setWellnessLog(updated);
    const r = await queueSync("wellness.save", { date: todayKey(), water, sleep, mood, activity, stress }, { key: `wellness:${todayKey()}` });
    if (r.status === "local") { toast.success("Saved on this device. Sign in to sync across devices."); return; }
    reportSaved(r, "Wellness data saved to your account.");
    if (r.status === "done") wellnessApi.summary(7).then(setWeeklySummary).catch(() => {});
  }

  // ─────────────────────────────────────────────
  // CYCLE
  // ─────────────────────────────────────────────
  async function saveCycleEntry() {
    if (!lmp) return;
    const existing = cycleHistory.find(e => e.date === lmp);
    const entry = {
      id: existing?.id, date: lmp, cycleLength, phase: phaseLabel,
      flow: cycleFlow || null, symptoms: cycleSymptoms, notes: cycleNotes,
      logged: new Date().toLocaleDateString("en-IN"),
    };
    const updated = [entry, ...cycleHistory.filter(e => e.date !== lmp)].slice(0, 24);
    setCycleHistory(updated);
    const r = await queueSync(
      "cycle.save",
      { id: existing?.id, clientId: `cyc-${deviceId()}-${lmp}`, date: lmp, cycleLength, flow: cycleFlow, symptoms: cycleSymptoms, notes: cycleNotes },
      { key: `cycle:${lmp}` }
    );
    if (r.status === "local") { toast.success("Cycle entry saved on this device."); return; }
    reportSaved(r, "Cycle entry saved to your account.");
    if (r.status === "done") cycleApi.predict().then(setCyclePrediction).catch(() => {});
  }

  function deleteCycleEntry(entry) {
    setConfirmState({
      title: "Delete this cycle entry?",
      message: `The entry for ${entry.date} will be removed${isAuthenticated ? " from this device and your account" : " from this device"}.`,
      confirmLabel: t("common.delete"),
      danger: true,
      onConfirm: async () => {
        setConfirmState(null);
        setCycleHistory(h => h.filter(e => e.date !== entry.date));
        if (!isAuthenticated) { toast.success("Entry deleted."); return; }
        if (entry.id) {
          const r = await queueSync("cycle.delete", { id: entry.id }, { key: `cycle-del:${entry.id}` });
          if (r.status === "done") { toast.success("Entry deleted."); cycleApi.predict().then(setCyclePrediction).catch(() => {}); }
          else if (r.status === "queued") toast.info(t("sync.offline.saved"));
          else if (r.status === "failed") toast.error(r.error?.userMessage);
        } else {
          removeByKey(`cycle:${entry.date}`);   // never reached the server
          toast.success("Entry deleted.");
        }
      },
    });
  }

  // ─────────────────────────────────────────────
  // TRUSTED CIRCLE
  // ─────────────────────────────────────────────
  function updateContact(i, field, val) {
    const updated = [...contacts]; updated[i] = { ...updated[i], [field]: val }; setContacts(updated);
  }

  const PHONE_RE = /^[+]?[\d\s()-]{7,20}$/;
  async function saveContacts() {
    const bad = contacts.findIndex(c => (c.name?.trim() || c.phone?.trim()) && !(c.name?.trim() && PHONE_RE.test(c.phone?.trim() || "")));
    if (bad !== -1) { toast.error(`Contact ${bad + 1}: enter a name and a valid phone number (7–20 digits).`); return false; }
    const badEmail = contacts.findIndex(c => c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim()));
    if (badEmail !== -1) { toast.error(`Contact ${badEmail + 1}: the e-mail address looks invalid.`); return false; }
    lsSet(LS.contacts, contacts);           // contacts.sync reads the saved local copy
    if (!isAuthenticated) { toast.success("Trusted Circle saved on this device."); return true; }
    const r = await queueSync("contacts.sync", {}, { key: "contacts" });
    reportSaved(r, "Trusted Circle saved to your account.");
    return r.status !== "failed";
  }

  // ─────────────────────────────────────────────
  // CHECK-IN (the timer always runs on the device; server alerts need internet)
  // ─────────────────────────────────────────────
  async function startCheckIn() {
    const end = new Date(Date.now() + checkInMins * 60000).toISOString();
    setCheckInEndTime(end);
    setCheckInActive(true);
    setCheckInAlert(false);
    lsSet(LS.checkInTime,   end);
    lsSet(LS.checkInActive, true);
    checkInIdRef.current = null; lsSet(LS.checkInId, null);
    if (!isAuthenticated) {
      toast.info("Timer started. Without an account only a banner appears here — no one is alerted automatically.");
      return;
    }
    const r = await queueSync("checkin.start", { deadline: end, label: "Safety Check-In", location: currentLoc, localId: end }, { key: "checkin:start" });
    if (r.status === "done") toast.info("Timer started. If you don't confirm in time, your Trusted Circle is alerted through the channels configured for this app.");
    else if (r.status === "queued") toast.info("Timer is running on this device. The server will only know about it once you're online — until then contacts will NOT be alerted automatically.");
    else if (r.status === "failed") toast.error(`${r.error?.userMessage} Contacts will NOT be alerted automatically.`);
  }

  function finishCheckIn(kind) {
    clearInterval(checkInTimerRef.current);
    setCheckInActive(false);
    setCheckInAlert(false);
    setCheckInRemain(null);
    lsSet(LS.checkInActive, false);
    const id = checkInIdRef.current;
    if (isAuthenticated) {
      if (id) queueSync(kind === "cancel" ? "checkin.cancel" : "checkin.confirm", { id }, { key: `checkin-end:${id}` });
      else removeByKey("checkin:start");          // the server never heard of it
    }
    checkInIdRef.current = null; lsSet(LS.checkInId, null);
  }
  const confirmSafe  = () => finishCheckIn("confirm");
  const cancelCheckIn = () => finishCheckIn("cancel");

  // ─────────────────────────────────────────────
  // GEOLOCATION
  // ─────────────────────────────────────────────
  async function fetchLoc() {
    const result = await getPreciseLocation({ timeoutMs: 10000 });
    if (!result.ok) {
      setLocError(result.code);
      return null;
    }
    setLocError(null);
    if (result.warning) toast.info(result.warning);
    setCurrentLoc(result.location);
    getAddressFromCoordinates(result.location.lat, result.location.lng).then(setCurrentAddress).catch(() => {});
    return result.location;
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
    setSosReport(null);
    const triggeredAt = Date.now();

    const loc = await fetchLoc();            // GPS works offline; null when unavailable — SOS still proceeds
    sosLocRef.current = loc;
    const mapsLink = loc ? `https://maps.google.com/?q=${loc.lat},${loc.lng}` : "Location unavailable";
    const msg = `🚨 EMERGENCY ALERT!\n\nI may be in danger. Please help me immediately!\n\n📍 My live location:\n${mapsLink}\n\n${SOS_SIG}`;
    const valid = contacts.filter(c => c.phone.trim());
    if (!valid.length) {
      toast.error("Add at least one emergency contact in Trusted Circle first. If you're in danger, call 112 now.");
      setSosSent(false); setEmergencyActive(false);
      return;
    }

    const ts = new Date().toLocaleString("en-IN");
    setLastSosTs(ts);   lsSet(LS.lastSosTs,  ts);
    if (loc) { setLastSosLoc(loc); lsSet(LS.lastSosLoc, loc); }

    // Device-based flow (works offline, no account needed): opens the SMS and
    // WhatsApp apps. The user must still press Send — we never claim otherwise.
    window.open(`sms:${valid.map(c => c.phone).join(",")}?body=${encodeURIComponent(msg)}`, "_self");
    setTimeout(() => window.open(`https://wa.me/${valid[0].phone.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`, "_blank"), 1000);
    setTimeout(() => setSosSent(false), 15000);

    // Local SOS record (survives reloads and offline periods).
    const clientEventId = sosApi.newEventId();
    sosEventIdRef.current = clientEventId;
    sosPayloadRef.current = { location: loc, clientEventId, clientTriggeredAt: triggeredAt };
    lsSet(LS.sosLocal, [{ clientEventId, at: triggeredAt, hasLocation: Boolean(loc), status: isAuthenticated ? "PENDING" : "LOCAL_ONLY" }, ...lsGet(LS.sosLocal, [])].slice(0, 20));

    if (!isAuthenticated) { setSosReport({ phase: "local" }); return; }
    await sendServerSOS();
  }

  /** Server-side SOS (signed-in users): sent now when online, otherwise queued and retried. */
  async function sendServerSOS() {
    const payload = sosPayloadRef.current;
    if (!payload) return;
    setSosReport({ phase: online ? "sending" : "queued", retrying: false });
    const r = await submitChange("sos.create", payload, { key: `sos:${payload.clientEventId}`, critical: true, isAuthed: () => isAuthedRef.current });
    if (r.status === "queued") setSosReport((prev) => (prev && prev.phase === "done" ? prev : { phase: "queued", retrying: online }));
    else if (r.status === "failed") setSosReport({ phase: "error", message: r.error?.userMessage });
  }

  /** "I'm safe": cancels a still-queued SOS locally, or marks the server event resolved. */
  async function resolveSOS(notifySafe) {
    const id = sosReport?.event?._id;
    if (!id) {
      const cid = sosEventIdRef.current;
      if (cid) { removeByKey(`sos:${cid}`); updateLocalSOS(cid, "CANCELLED_BEFORE_SENT"); }
      setSosReport(null); setEmergencyActive(false);
      toast.success("Cancelled. The queued SOS will not be sent.");
      return;
    }
    setResolving(true);
    try {
      const { safeNotice } = await sosApi.resolve(id, notifySafe);
      const told = safeNotice?.overall === "SENT";
      setSosReport({ phase: "resolved", message: notifySafe ? (told ? "Your contacts were sent an “I'm safe” message (delivery can't be guaranteed)." : "Marked safe. We couldn't send an “I'm safe” message to your contacts — please tell them directly.") : "Marked safe." });
      setEmergencyActive(false);
    } catch (err) {
      toast.error(`Couldn't update the SOS: ${err.userMessage}`);
    } finally { setResolving(false); }
  }

  function contactAlertMsg() {
    const loc = currentLoc ? `https://maps.google.com/?q=${currentLoc.lat},${currentLoc.lng}` : "Enable location in app";
    return `🚨 EMERGENCY! I may be in danger.\n📍 Location: ${loc}\nPlease help immediately!\n${SOS_SIG}`;
  }

  // ─────────────────────────────────────────────
  // CHAT
  // Hybrid flow: Rule Engine → Intent Engine → backend /api/chat → AI provider
  // ─────────────────────────────────────────────
  async function sendMessage() {
    if (!inputText.trim() || isLoading) return;

    const userMsg = inputText.trim();
    setInputText("");
    voice.reset();
    const history = messages;
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setIsLoading(true);

    try {
      // Rule Engine → Intent Engine → Local Knowledge Base (all offline) →
      // connectivity check → backend → Gemini. See services/chatRouter.js.
      const result = await routeChat({ text: userMsg, history, lang });
      const delay = result.source === "rule" || result.source === "kb" ? 450 : 0;
      await new Promise((r) => setTimeout(r, delay));
      setMessages(prev => [...prev, { role: "assistant", content: result.reply, source: result.source, translated: result.translated }]);
      if (result.action === "OPEN_EMERGENCY") setScreen("emergency");
      if (voiceOn) speak(result.reply, result.lang);
    } finally {
      setIsLoading(false);
    }
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

      <a href="#main-content" className="skip-link">{t("app.skip")}</a>
      {!online && (
        <div className="offline-banner" role="status">
          {connectivity === "offline" ? t("conn.offline.banner") : t("conn.server")}
        </div>
      )}
      {justReconnected && <div className="online-banner" role="status">✅ {t("conn.back")}{syncStatusText()}</div>}
      {authStatus === "loading" && <div role="status" className="sr-only">Restoring your session…</div>}

      {/* ── HEADER ── */}
      <Header
  screen={screen}
  setScreen={setScreen}
  APP_NAME={APP_NAME}
  APP_TAGLINE={APP_TAGLINE}
  isSignedIn={isAuthenticated}
  accountLabel={isAuthenticated ? "Account" : "Sign in"}
/>
        

      {/* ── CHECK-IN ALERT BANNER ── */}
      {checkInAlert && (
        <div role="alert" style={{
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

      <main id="main-content" tabIndex={-1} style={{ outline: "none" }}>
      {/* ════════════════════════════════════════
          SCREEN: ACCOUNT (optional sign-in)
      ════════════════════════════════════════ */}
      {screen === "account" && (
        <AuthPage
          cardStyle={cardStyle}
          inputStyle={inputStyle}
          btnPrimary={btnPrimary}
          setScreen={setScreen}
          resetToken={resetToken}
          onResetDone={() => {
            setResetToken(null);
            try { window.history.replaceState({}, "", window.location.pathname); } catch { /* ignore */ }
          }}
        />
      )}

      {/* ════════════════════════════════════════
          SCREEN: HOME
      ════════════════════════════════════════ */}
      {screen === "home" && (
        <div style={{ padding: "12px 16px 0" }}>
          <LanguageSelector />
          <div style={{ height: 8 }} />
          <ConnectivityPanel />
        </div>
      )}
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
          QUICK_ACTIONS={QUICK_ACTIONS.map((a) => ({ ...a, label: t(`quick.${a.screen}`) }))}
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
          suggestions={chatSuggestions}
          inputText={inputText}
          setInputText={setInputText}
          sendMessage={sendMessage}
          voiceOn={voiceOn}
          setVoiceOn={setVoiceOn}
          APP_NAME={APP_NAME}
          t={t}
          voice={voice}
          connectivity={connectivity}
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
          cycleFlow={cycleFlow}
          setCycleFlow={setCycleFlow}
          cycleSymptoms={cycleSymptoms}
          setCycleSymptoms={setCycleSymptoms}
          cycleNotes={cycleNotes}
          setCycleNotes={setCycleNotes}
          deleteCycleEntry={deleteCycleEntry}
          cyclePrediction={cyclePrediction}
          isAuthenticated={isAuthenticated}
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
          activity={activity}
          setActivity={setActivity}
          stress={stress}
          setStress={setStress}
          weeklySummary={weeklySummary}
          isAuthenticated={isAuthenticated}
          syncState={sync}
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
          saveContacts={saveContacts}
          isAuthenticated={isAuthenticated}
          syncState={sync}
          setScreen={setScreen}
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
          cancelCheckIn={cancelCheckIn}
          fmtRemain={fmtRemain}
          isAuthenticated={isAuthenticated}
        />
      )}

      {/* ════════════════════════════════════════
          SCREEN: SAFE ROUTE
      ════════════════════════════════════════ */}
      {screen === "route" && (
        <SafeRoutePage
          currentLoc={currentLoc}
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
          isAuthenticated={isAuthenticated}
          setScreen={setScreen}
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
          sosReport={sosReport}
          isAuthenticated={isAuthenticated}
          retrySOS={() => sendServerSOS()}
          resolveSOS={resolveSOS}
          dismissSOSReport={() => { setSosReport(null); setEmergencyActive(false); }}
          resolving={resolving}
          locationErrorCode={locError || (gpsStatus === "Permission Denied" ? "PERMISSION_DENIED" : null)}
        />
      )}

      </main>

      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title}
        message={confirmState?.message}
        confirmLabel={confirmState?.confirmLabel}
        danger={confirmState?.danger}
        onConfirm={confirmState?.onConfirm}
        onCancel={() => setConfirmState(null)}
      />

      {/* ── BOTTOM NAV ── */}
      {screen === "home" && (
        <nav aria-label={t("nav.main")} style={{
          position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
          width: "100%", maxWidth: 430, background: "#fff",
          borderTop: "1px solid rgba(194,24,91,0.15)",
          display: "flex", padding: "8px 0",
          boxShadow: "0 -4px 20px rgba(194,24,91,0.1)",
        }}>
          {[
            { icon: "🏠", label: t("nav.home"),    s: "home"      },
            { icon: "📅", label: t("nav.tracker"), s: "tracker"   },
            { icon: "💬", label: t("nav.chat"),    s: "chat"      },
            { icon: "💪", label: t("nav.wellness"),s: "wellness"  },
            { icon: "🚨", label: t("nav.safety"),  s: "emergency" },
          ].map(({ icon, label, s }) => (
            <button key={s} onClick={() => setScreen(s)} aria-current={screen === s ? "page" : undefined} style={{
              flex: 1, background: "none", border: "none", cursor: "pointer",
              padding: "6px 0", display: "flex", flexDirection: "column", alignItems: "center", minHeight: 48,
            }}>
              <span aria-hidden="true" style={{ fontSize: 20 }}>{icon}</span>
              <span style={{ fontSize: 11, color: screen === s ? "#c2185b" : "#6b6b6b", marginTop: 2, fontWeight: screen === s ? "bold" : "normal" }}>{label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}