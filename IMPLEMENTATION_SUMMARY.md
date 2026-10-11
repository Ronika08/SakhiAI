# SakhiAI — Production Upgrade (offline-first) — Implementation Summary

Final package: **SakhiAI-Production-Final.zip**. Built on the existing SakhiAI project (React/Vite + Express/MongoDB). No existing file was deleted and no feature was removed (verified by diffing against the original ZIP); everything is layered on top, and anonymous/`localStorage` use still works.

## How to read the status labels

| Label | Meaning |
|---|---|
| **IMPLEMENTED** | Code exists in the project |
| **AUTOMATED-TESTED** | Covered by automated tests (external services mocked) — run in this build environment |
| **LIVE-INTEGRATION-VERIFIED** | Exercised against the real external service. **Nothing in this project is in this category** — the build environment has no Gemini/MongoDB/e-mail/push/Maps credentials or devices |
| **REQUIRES USER CONFIGURATION** | Needs your keys/URLs/hosting or a physical device |

## Verification run (all executed from a clean extract of the ZIP)

| Check | Result |
|---|---|
| Frontend tests (Vitest + Testing Library) | **206 passed** (13 files) |
| Backend tests (Vitest + Supertest) | **137 passed** (15 files) |
| ESLint (frontend, backend, service worker) | 0 errors, 0 warnings |
| `npm audit` (frontend and backend) | **0 vulnerabilities** (no `--force`; see "Dependencies") |
| Dependency check (`npm run check:deps`) | every imported package is declared in the right `package.json` |
| Production build + PWA verification (`npm run verify:build`) | manifest, 3 icons, service worker, offline page, precache manifest, no secret patterns in `dist/` |
| Backend startup | boots with only placeholder env; `/health` 200, `/ready` 200 (reports DB `not_configured`), DB routes → 503 `DATABASE_ERROR`, safety replies work, graceful SIGTERM exit code 0 |
| Release gate (`npm run check:final`) | all expected files present; no `.env`, key or credential patterns; env examples hold placeholders only |

## Status by requirement

### 1 · AI / Gemini
| Item | Status |
|---|---|
| Gemini is the primary **online fallback**; backend owns provider, model, key, system prompt, token/history limits; client `model`/`system`/`provider` ignored | IMPLEMENTED · AUTOMATED-TESTED |
| Current model default `gemini-3.5-flash` + automatic fallback `gemini-3.1-flash-lite` (404/429); retired 1.5/2.0 and retiring 2.5 never default; model name sanitised | IMPLEMENTED · AUTOMATED-TESTED (config + service tests) |
| 401/403, 404, 429, 5xx, network, timeout, retry/backoff, safety-block and empty/malformed responses | IMPLEMENTED · AUTOMATED-TESTED |
| Key only in `x-goog-api-key` header; never in URL, logs, frontend bundle (bundle scanned) | IMPLEMENTED · AUTOMATED-TESTED |
| Prompt-injection screening, medical-safety layer (emergency / self-harm / dosage), reply validation (dosage text, prompt leak, over-confident diagnosis), localized fallbacks | IMPLEMENTED · AUTOMATED-TESTED |
| **That your key, model and quota actually work** | **REQUIRES USER CONFIGURATION** → `cd backend && npm run check:gemini` (one real request; prints outcome, never the key) |

### 2 · Offline-first architecture
| Item | Status |
|---|---|
| Chat: Rule Engine → Intent Engine → **Local Knowledge Base** → connectivity check → (offline reply \| backend → Gemini). Gemini is never the default | IMPLEMENTED · AUTOMATED-TESTED |
| Local knowledge: 43 entries covering periods, PCOS, pregnancy, nutrition, women's health, first aid, safety, mental wellbeing, medicine safety, cycle tracking, wellness, emergency — each in **English, Hindi, Kannada**; every entry checked for all 3 languages, no doses, emergency numbers in critical answers | IMPLEMENTED · AUTOMATED-TESTED |
| Required tests: known period / PCOS / safety / first-aid / nutrition question → **no network request** (neither the injected API nor `fetch` is called); unknown + internet → Gemini; unknown + no internet → offline response | AUTOMATED-TESTED (`chatRouter.test.js`, 49 cases) |
| Fixed a latent bug: the Rule Engine matched `"hi"` inside words ("this", "which"), swallowing real questions as greetings | IMPLEMENTED · AUTOMATED-TESTED |

### 3 · PWA / offline
| Item | Status |
|---|---|
| Installable manifest + icons; service worker precaches **every built file** via an emitted `precache-manifest.json` (first offline launch works); network-first navigation with offline fallback; never caches/intercepts `/api/*` or cross-origin requests | IMPLEMENTED · AUTOMATED-TESTED (sandboxed SW test + build verification) |
| Offline UI: banners, "OFFLINE AVAILABLE / INTERNET REQUIRED" panel, offline map/nearby notices, reconnection banner | IMPLEMENTED · AUTOMATED-TESTED (component tests) |
| **Real install/offline behaviour on phones and browsers; HTTPS hosting** | **REQUIRES USER CONFIGURATION / device testing** |

### 4 · Authentication
Register, login, logout, short-lived JWT access tokens, rotating hashed refresh tokens with reuse detection, token-expiry handling (silent refresh, `TOKEN_EXPIRED`), password policy, lockout, forgot/reset password, change password, role authorization, frontend sign-in/up/forgot/reset UI, session restore; anonymous users keep local functionality. **IMPLEMENTED · AUTOMATED-TESTED.** Forgot-password e-mail delivery **REQUIRES USER CONFIGURATION** (e-mail provider).

### 5 · Database & safe sync
MongoDB wired in (it was never connected before). Persisted: users, Trusted Circle, SOS, Check-In, Cycle, Mood, Wellness. **Outbox sync** (`syncQueue.js`): local change → queue → reconnect → idempotent API call → MongoDB; nothing is lost on network errors/timeouts/5xx/429/expired sessions; SOS syncs first; same-key changes coalesce; server pull never overwrites pending local edits. Server de-duplicates replays (`clientId` / `clientEventId`). **IMPLEMENTED · AUTOMATED-TESTED** (mocked models — no real MongoDB test). Real database behaviour **REQUIRES USER CONFIGURATION** (`MONGODB_URI`).

### 6 · SOS (safety-critical)
Countdown + cancel; location capture with range/(0,0)/accuracy validation (SOS proceeds without GPS); **created locally when offline** and synced with its original time (contacts are told it is late); idempotent retries; automatic server retry with backoff; honest states: `SENT` (a provider *accepted* the alert — never worded as delivered), `RETRYING`, `FAILED`, `NOT_CONFIGURED`, `NO_RECIPIENT`, `NO_CONTACTS`, `PENDING`; UI never claims a contact was notified unless a provider accepted it; the device SMS/WhatsApp flow remains (user taps Send). Provider abstraction + free providers: **Web Push (VAPID), Webhook (HMAC-signed), E-mail (Resend free tier or any SMTP)**; paid SMS is not required. **IMPLEMENTED · AUTOMATED-TESTED.** Real delivery on your channels **REQUIRES USER CONFIGURATION** and a test (Account → "Send test alert").

> "SENT" means the provider's API accepted the message. No provider here can confirm that a person read it, so it is never claimed.

### 7 · GPS / Google Maps / Safe Route
Permission-denied, unsupported, timeout (with low-accuracy fallback), invalid-coordinate, low-accuracy handling; GPS works offline; map/nearby/route features show explicit "internet required" states when offline. **Safe Route is now real** (it was a "Coming soon" stub): server-side geocoding + Directions, categorised errors (quota, key denied, no route, timeout, network), key never reaches the browser. **IMPLEMENTED · AUTOMATED-TESTED** (mocked Google responses). Live map/route behaviour and the Maps key **REQUIRE USER CONFIGURATION**. Note: the route is the fastest route — it does not rate how *safe* an area is, and the UI says so.

### 8 · Voice input (new)
Mic button in chat, start/stop, speech-to-text into the **editable** input (never auto-sent), permission-denied / unsupported / no-mic / no-speech / network / processing states, live-region announcements, accessible labels. Native browser recognition first (offline only where the device supports on-device recognition — otherwise the UI says it needs internet); optional configurable online fallback (`VOICE_STT_ENABLED`, off by default, key stays server-side). Also: replies can be read aloud with device speech synthesis. **IMPLEMENTED · AUTOMATED-TESTED** (state machine, components, backend endpoint). Microphone/recognition quality on real devices and in Kannada/Hindi **REQUIRES device testing**.

### 9 · Translation (new)
English (default), हिन्दी, ಕನ್ನಡ: accessible language selector; static UI dictionary (every English key present in hi/kn, placeholders checked); local answers, rule-engine matches, offline replies, SOS status and the backend's vetted emergency/safety replies localized; AI replies in the selected language. Arbitrary free-text translation is AI-only and labelled **INTERNET REQUIRED**. **IMPLEMENTED · AUTOMATED-TESTED.** ⚠ The Hindi/Kannada text was written for this project and is **not** native-speaker reviewed — **REQUIRES human review before public launch**, especially emergency and medical wording.

### 10 · Health / medical safety
No diagnosis ("symptoms can occur with…"), educational disclaimers on non-critical local answers, professional-care and emergency guidance, red-flag symptom answers, medicine safety (no doses anywhere — a test scans every answer in all 3 languages), cycle/fertility shown as estimates and not as contraception. Safety/emergency rules and answers are local and work offline. Server screening in English/Hindi/Kannada. **IMPLEMENTED · AUTOMATED-TESTED** (rule-based, conservative, **not exhaustive** and not clinically validated).

### 11 · Security
Helmet + strict CSP, strict CORS, rate limits (API/auth/reset/chat/SOS/voice), validation + sanitisation, payload limits, request IDs, categorised safe errors, JWT hardening (HS256 only, short-lived), bcrypt, lockout, refresh-token hashing/rotation, log redaction (keys, JWTs, bearer tokens, passwords; no message bodies), prompt-injection protection, AI input/output validation, secrets only in `backend/.env`. **IMPLEMENTED · AUTOMATED-TESTED.**

### 12 · Tests · 13 · CI/CD
All areas listed in the brief have tests (see counts above). GitHub Actions (`.github/workflows/ci.yml`): install, dependency check, `npm audit`, lint, frontend + backend tests, build, PWA verification, bundle secret scan, backend syntax/env validation, repository secret scan — **no real secrets** (placeholders only). The workflow itself has not been run on GitHub from here.

### 14 · Accessibility · 15 · UI/UX
Skip link; `header/main/nav` landmarks; labelled inputs and fieldsets; `aria-pressed/current/live`; chat log region; focus-visible; accessible dialogs (focus trap, Esc); accessible SOS countdown/cancel and voice/language controls; reduced-motion; improved contrast of grey text; loading/offline/error/success/permission/empty/syncing/notification/AI-unavailable/voice/language states. **IMPLEMENTED · partly AUTOMATED-TESTED.** Screen-reader and contrast audits with real tools **REQUIRE manual/device testing.**

### 16–18 · Deployment, env, docs
`backend/Dockerfile`, `Dockerfile.frontend`, `nginx.conf`, `docker-compose.yml`, `render.yaml`, `/health` + `/ready`, graceful shutdown. `backend/env.example` marks each variable **required / required-prod / optional / prod / offline-only**; `.env.example` (frontend) has only `VITE_API_BASE_URL`. Docs: `README.md`, `docs/ARCHITECTURE|OFFLINE|API|DATABASE|SECURITY|DEPLOYMENT.md`. Deployment itself **REQUIRES USER CONFIGURATION**.

### 19 · Dependencies
Every import is declared (`npm run check:deps` runs in CI). `npm run setup` installs both projects — running backend tests without installing the backend first was the cause of "Cannot find package 'vitest'/'compression'". Vulnerabilities were fixed **without `--force`**: `npm audit fix`; backend `nodemailer` upgraded 6 → 10 (the project only uses `createTransport`/`sendMail`, verified); backend `vitest` 2 → 5; `nodemon` (dev-only, vulnerable transitive `braces`) replaced by Node's built-in `node --watch`. Both audits: 0 vulnerabilities.

## What was added or changed in this round
**New — frontend:** `services/{chatRouter,localKnowledge,connectivity,syncQueue,syncHandlers,voiceState,tts}.js`, `hooks/{useVoiceInput,useConnectivity}.js`, `components/{VoiceButton,LanguageSelector,ConnectivityPanel}.jsx`, `i18n/*`, `data/kb/*` (40-entry knowledge base), tests (`chatRouter`, `localKnowledge`, `translate`, `voiceState`, `syncQueue`, `connectivity`, `sw`, voice/language components), `scripts/{checkDeps,verifyBuild,finalCheck}.mjs`, `docs/OFFLINE.md`.
**New — backend:** `controllers/voiceController.js`, `routes/voiceRoutes.js`, `services/chatSafetyI18n.js`, `scripts/checkGemini.js`, tests (`language-safety`, `voice`, `sos-retry`, `maps`, `sync-idempotency`, `config-gemini`, `authorization`).
**Modified:** `SakhiAI.jsx` (offline-first chat, outbox sync, queued SOS, language/connectivity), `ChatPage`, `HomePage`, `Header`, `SOSStatus`, `SafeRoutePage`, `NearbyServices`, `public/sw.js`, `vite.config.js` (precache plugin), `chatService.js` (word-boundary matching only), backend `geminiService` (+ audio transcription), `chatSafetyService`, `chatController`, `emergencySOSService` (retry/late sync), `notificationService`, `mapsService` (+ geocoding, timeouts), models (`clientId`s, SOS retry fields), `app.js`, `routes`, `env.example`, CI, README and docs.

## Environment variables
See `backend/env.example` (authoritative, annotated) and `.env.example`. Minimum: **to run locally** — `JWT_SECRET`, `MONGODB_URI` (only for accounts/sync), `GEMINI_API_KEY` + `GEMINI_MODEL` (only for the AI fallback). **Production adds** — `NODE_ENV=production`, `CORS_ALLOWED_ORIGINS`, `APP_URL`, `TRUST_PROXY`. **Offline features need none.**

## Run it
```bash
npm run setup                       # installs frontend + backend dependencies
cp backend/env.example backend/.env # edit: GEMINI_API_KEY, JWT_SECRET, MONGODB_URI, ...
cp .env.example .env.local
(cd backend && npm run validate:env && npm run check:gemini && npm run dev)   # http://localhost:5000
npm run dev                                                                    # http://localhost:5173
npm test && npm run test:backend    # automated tests
npm run build && npm run verify:build   # production build + PWA verification
npm run check:all                   # everything above in one go
```

## Known limitations (genuine)
- **No live integration was possible here.** Gemini, MongoDB, e-mail/push/webhook providers, Google Maps, real browsers/phones: all unverified live.
- **"SENT" ≠ delivered.** Providers accept messages; no free channel confirms a human read them. Server SOS alerts reach only channels you configure (Web Push reaches the user's devices and contacts who have a SakhiAI account with the same e-mail and enabled push). No server-side SMS/WhatsApp (paid) — the phone composer remains and the user must tap Send.
- **Voice:** most browsers' speech recognition uses the vendor's online service; it works offline only with on-device recognition support. Kannada/Hindi recognition quality is browser-dependent. The server fallback is opt-in and online-only.
- **Hindi/Kannada** content is unreviewed by native speakers.
- **Local knowledge is finite** (43 entries) and general education only; keyword matching can miss unusual phrasing (the user then gets the AI online or the offline reply). It is not clinically validated.
- **Offline SOS:** while offline nothing is alerted automatically; the device SMS/WhatsApp flow and `112` are the immediate options, and the queued server alert is sent only after the phone reconnects *and* the app is running/reopened (browsers may pause background tabs). Missed check-in alerts are processed by the server only while it is running; free hosts that sleep delay them.
- Safe Route finds the fastest route, not the "safest" one.
- The offline outbox lives in `localStorage` (capped at 500 operations); the refresh token is also in `localStorage` (documented XSS trade-off in `docs/SECURITY.md`). Rate limiting is per-instance memory.
- Trusted Circle UI remains 3 slots (API allows 10). No end-to-end browser tests and no real-MongoDB tests.
