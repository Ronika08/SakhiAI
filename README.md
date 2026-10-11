# 🌸 SakhiAI — Women's Health & Safety Companion

SakhiAI is a mobile-first web app (installable PWA) that combines **women's health tracking**, an **AI health assistant**, and a **personal-safety toolkit** — SOS, Trusted Circle, safety check-ins, live location and nearby help.

> ⚠️ **Safety disclaimer.** SakhiAI provides general information and convenience tools. It is **not** a medical device, does **not** diagnose conditions, and is **not** a replacement for emergency services. In an emergency call **112** (India) or your local number. Automatic alerts depend on the notification channels configured by the operator and **delivery can never be guaranteed**.

## Problem & solution

Women often need three things in one trusted place: private health tracking (cycle, mood, sleep, hydration), reliable health information, and fast help when they feel unsafe. SakhiAI delivers all three with an offline-friendly, privacy-conscious design and honest behaviour — it never claims an alert reached someone unless a provider actually accepted it.

## Features

| Area | What you get |
|---|---|
| **Offline-first chat** | Rule Engine → Intent Engine → **Local Knowledge Base** (EN/HI/KN, works offline) → connectivity check → backend → **Gemini** (online fallback only), with a backend medical-safety layer |
| **Languages** | English (default), हिन्दी, ಕನ್ನಡ — UI, local answers and emergency/safety guidance work offline; AI replies in the chosen language |
| **Voice input** | Mic button in chat, speech-to-text into the editable input; native browser/device recognition first, optional online fallback |
| **SOS** | Countdown & cancel, GPS with accuracy/validation, SMS/WhatsApp composer, **server alerts** (Web Push / e-mail / webhook) with honest status, retry, "I'm safe" |
| **Trusted Circle** | Up to 3 contacts in the UI (10 in API), primary contact, e-mail for alerts, synced to account |
| **Check-In** | Safety timer; when signed in, contacts are alerted automatically if you miss it |
| **Maps** | Live location map, nearby hospitals/police/pharmacies, Safe Route, permission/accuracy/offline handling |
| **Cycle Tracker** | History, edit/delete, flow, symptoms, notes, next-period & fertile-window **estimates**, irregular-cycle detection |
| **Wellness & Mood** | Water, sleep, activity, stress, mood, history, weekly summary |
| **Health Tips** | Curated tips (unchanged) |
| **Accounts (optional)** | Register/login/logout, refresh tokens, forgot/reset password. **Everything still works anonymously** using localStorage |
| **PWA / offline** | Installable, precached app shell (first offline launch works), offline page with emergency numbers, safe offline→online sync, push notifications |

## Architecture (summary)

```
              ┌───────────────────────── Browser / installed PWA (works OFFLINE) ─────────────────────────┐
 User ───────►│ Rule Engine → Intent Engine → Local Knowledge Base (en/hi/kn) → answered locally?          │
              │ localStorage (all trackers)   Outbox (queued changes)   Service worker (precached shell)    │
              └───────────────┬────────────────────────────────────────────────────────────────────────────┘
                              │ not answerable locally AND online                │ signed in + online (sync, SOS)
                              ▼                                                  ▼
                      Express API ──► chatSafety ──► aiProvider ──► Gemini        MongoDB
                              └────► notificationService ──► Web Push | E-mail | Webhook
```

Details and sequence diagrams: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). **Offline guide: [`docs/OFFLINE.md`](docs/OFFLINE.md).**

### OFFLINE AVAILABLE vs INTERNET REQUIRED

| ✅ OFFLINE AVAILABLE | 🌐 INTERNET REQUIRED |
|---|---|
| App shell, trackers, saved data, Rule & Intent engines, local knowledge (periods, PCOS, pregnancy, nutrition, women's health, first aid, safety, mental wellbeing, medicine safety), languages, emergency numbers, GPS position, SMS composer, SOS record (queued), browser voice input (device dependent) | Gemini AI answers, online maps/routes/nearby search, address lookup, sign-in & sync, server SOS alerts (e-mail/push/webhook), online speech-to-text fallback |

### AI architecture
`chatController → chatSafetyService (screen) → aiProvider → geminiService → Gemini`.
The **backend owns** the provider, model, system prompt and limits. The frontend sends only `{ messages }`. Safety features: emergency/self-harm/medication-dosage interception *before* any AI call, prompt-injection detection, history trimming, reply validation (blocks dosage text & prompt leaks, adds diagnosis disclaimers), per-failure safe fallbacks. Gemini calls have timeouts, retries, automatic fallback model, and categorised 401/403/404/429/safety-block/empty-response handling.

### Local knowledge base
`src/data/kb/*` holds 43 structured entries (topic, keywords in all three languages, answers in English/Hindi/Kannada, priority, optional UI action). `src/services/localKnowledge.js` scores them with no network. Safety-critical entries (emergency numbers, first aid, medicine safety) outrank general ones and are never padded with doses. Non-critical answers get an educational disclaimer. **Hindi/Kannada safety wording should be reviewed by native speakers before public launch.**

### Voice input
`src/hooks/useVoiceInput.js` + `services/voiceState.js` (pure state machine, unit-tested). The transcript is placed in the chat box for editing and is **never auto-sent**. Native `SpeechRecognition` is preferred (language follows the selected UI language: `en-IN`/`hi-IN`/`kn-IN`); an offline request asks for on-device recognition where supported. The optional server fallback (`VOICE_STT_ENABLED=true`) records ≤30 s of audio and transcribes it via Gemini — online only, explicit opt-in, key stays on the server.

### Translation
Static dictionaries (`src/i18n/translations.js`) for UI labels and (`src/data/kb`) for health/safety answers, plus localized rule-engine matches, the SOS status panel, offline replies and the backend's vetted safety replies. Arbitrary free text is translated only by the AI (internet required). English is the default.

### Rule Engine & Intent Engine
Pure frontend functions in `src/services/chatService.js` with data in `src/constants/`. A keyword **rule** picks a category (Greeting, PCOS, Emergency, Medication Disclaimer, …); an **intent** refines it (e.g. PCOS → Diet / Symptoms). Emergency rules open the Emergency screen. Anything unmatched goes to the backend AI.

### Database
MongoDB/Mongoose: `User, EmergencyContact, EmergencySOS, SafetyCheckIn, CycleLog, MoodLog, WellnessLog, RefreshToken, PasswordReset, PushSubscription`. See [`docs/DATABASE.md`](docs/DATABASE.md).

### Authentication & security
Short-lived JWT access tokens + rotating, hashed refresh tokens with reuse detection; bcrypt; lockout; password policy; Helmet, strict CORS, rate limits, validation/sanitisation, request IDs, redacted logs. See [`docs/SECURITY.md`](docs/SECURITY.md).

## Setup

```bash
git clone … && cd sakhiai
npm run setup          # installs frontend AND backend dependencies (avoids "Cannot find package 'vitest'")
```


Requirements: **Node.js ≥ 20**, MongoDB (local or free Atlas M0), a Gemini API key.

```bash
# 1. Backend
cd backend
cp env.example .env          # then edit .env — put GEMINI_API_KEY, JWT_SECRET, MONGODB_URI here
npm run validate:env         # checks configuration (never prints secret values)
npm run dev                  # http://localhost:5000  (GET /health)

# 2. Frontend (new terminal, project root)
cp .env.example .env.local   # VITE_API_BASE_URL=http://localhost:5000
npm run dev                  # http://localhost:5173
```

Check your Gemini setup with a real request (uses your `backend/.env`, never prints the key): `cd backend && npm run check:gemini`

```bash
```

Generate a JWT secret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

### Environment variables
Backend: see [`backend/env.example`](backend/env.example) (all placeholders). Frontend: only `VITE_API_BASE_URL`. **No secret ever belongs in a `VITE_*` variable.**

### Gemini
Set `DEFAULT_AI_PROVIDER=gemini`, `GEMINI_API_KEY=…`, `GEMINI_MODEL=<supported model>` in `backend/.env`. The default is `gemini-3.5-flash` with automatic fallback to `GEMINI_FALLBACK_MODEL` (`gemini-3.1-flash-lite`) on 404/429. Check Google's [model list](https://ai.google.dev/gemini-api/docs/models) — models are retired periodically (Gemini 1.5/2.0 are shut down; 2.5 Flash is scheduled for 16 Oct 2026).

### SOS notification channels (all free, all optional)
Webhook (ntfy.sh / Discord / Slack / n8n), e-mail (Resend free tier or any SMTP), Web Push (VAPID). With none configured, SOS reports **`NOT_CONFIGURED`** and the UI says no one was notified. Details: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md#sos-notification-channels).

## Development commands

| Command | Purpose |
|---|---|
| `npm run dev` / `npm run build` / `npm run preview` | Frontend dev / production build / preview |
| `npm run lint` | ESLint (frontend + backend) |
| `npm test` | Frontend tests (Vitest + Testing Library) |
| `npm run test:backend` | Backend tests (Vitest + Supertest, all external services mocked) |
| `npm run setup` | install frontend + backend dependencies |
| `npm run check:deps` | verify every imported package is declared (CI runs it) |
| `npm run verify:build` | verify the production PWA build (manifest, service worker, precache, no secrets) |
| `npm run check:final` | release gate: expected files present, no secrets |
| `npm run check:all` | deps + lint + all tests + build + PWA verification |
| `cd backend && npm run dev / start / check / validate:env` | Backend dev / prod / syntax / env check |

## Testing
Automated tests never call paid/external APIs (Gemini, e-mail, push, webhooks are mocked) and never read your `.env`. Backend: Gemini service (401/403/404/429/5xx/timeout/safety-block/empty), Gemini configuration, AI safety (en/hi/kn), chat route, auth & authorization, notification honesty, SOS service incl. offline-created and retried SOS, idempotent sync, Maps errors, optional voice STT, security middleware, cycle & wellness logic. Frontend: Rule/Intent engines, **offline-first chat routing** (known questions → no network; unknown + online → Gemini; unknown + offline → offline reply), local knowledge integrity (every entry in EN/HI/KN, no doses), translation, voice state machine, offline outbox, connectivity, service worker (sandboxed), API client, location handling and accessible components.

## API
See [`docs/API.md`](docs/API.md).

## Deployment
See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) (Render blueprint, Docker, compose, env checklist, HTTPS/CORS notes).

## Verification status (be precise)
**IMPLEMENTED + AUTOMATED-TESTED:** everything in the feature table above (mocked external services).
**LIVE-INTEGRATION-VERIFIED:** *nothing* — Gemini, MongoDB, e-mail/push/webhook providers, Google Maps and browser/device behaviour could not be exercised from the build environment.
**REQUIRES YOUR CONFIGURATION / DEVICE TESTING:** your Gemini key (`npm run check:gemini`), MongoDB URI, notification channel(s), Maps key, HTTPS hosting, PWA install and offline behaviour on real phones, microphone/GPS permissions, and native-speaker review of the Hindi/Kannada text. See `IMPLEMENTATION_SUMMARY.md`.

## Known limitations
- Delivery of SOS alerts cannot be **confirmed**; "SENT" means a provider accepted the message.
- Voice recognition in most browsers uses the browser vendor's online service; it works offline only where the device supports on-device recognition. Speech recognition for Kannada/Hindi depends on the browser.
- Local knowledge answers are general education; the answer set is finite — unknown questions need the internet (or show the offline reply).
- Hindi/Kannada translations are machine-assisted drafts and need native-speaker review.
- Web Push reaches a contact only if they are a SakhiAI user (same e-mail) who enabled push; e-mail needs an address on file. SMS/WhatsApp from the server would need a paid gateway and is intentionally not built in (the provider interface makes it easy to add).
- Offline: tracking, logs, emergency numbers and the app shell work; GPS address lookup, maps, AI answers, sync and server alerts need internet.
- Refresh token is stored in `localStorage` (XSS trade-off; see security doc). The Google Maps views use keyless embeds; the server-side route planner (`POST /api/routes/plan`) needs `GOOGLE_MAPS_API_KEY`.
- Predictions (cycle/fertile window) are estimates, not medical advice or contraception.
- No ML/clinical validation; the safety layer is rule-based and conservative, not exhaustive.

## License / disclaimer
Educational/community project. Not a medical device.
