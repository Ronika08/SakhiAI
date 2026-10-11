# Offline-first design

SakhiAI is built so its **core features do not need the internet**. Gemini is an *online fallback*, never the default path.

## OFFLINE AVAILABLE ✅

| Feature | How |
|---|---|
| App shell & all screens | Service worker precaches every built file (`precache-manifest.json`), so even the **first** offline launch works |
| Rule Engine & Intent Engine | Pure JavaScript bundled in the app |
| Local knowledge base (43 entries) | Periods, PCOS, pregnancy, nutrition, women's health, first aid, safety, mental wellbeing, medicine safety, cycle tracking, wellness, emergency guidance — in **English, Hindi, Kannada** |
| Translations of the interface & local answers | Static dictionary (`src/i18n/translations.js`, `src/data/kb/*`) |
| Emergency numbers | `tel:` links (the phone's dialer needs no data) and `public/offline.html` |
| Trackers: cycle, wellness, mood, check-in timer, Trusted Circle | `localStorage` (anonymous) — also the local cache for signed-in users |
| GPS position | Device positioning works without data (accuracy depends on the device) |
| SOS countdown/cancel, SMS composer | Opens the phone's SMS/WhatsApp app; **you must tap Send** |
| SOS record while offline | Saved on the device (status `QUEUED`/`RETRYING`) and sent automatically when the connection returns |
| Voice input | Uses the browser's native speech recognition. Offline only on browsers/devices that support **on-device** recognition (`processLocally`); otherwise the browser itself needs its online service and SakhiAI says so |
| Reading replies aloud | Device speech synthesis (needs an installed voice) |
| Changes to trackers while signed in | Queued in the **outbox** and synced later |

## INTERNET REQUIRED 🌐

| Feature | Why |
|---|---|
| AI (Gemini) answers for questions the local knowledge cannot answer | Calls the SakhiAI backend → Gemini |
| Arbitrary-text translation by the AI | Done by Gemini (the selected language is sent so it answers in that language) |
| Online maps, route search, nearby police/hospitals, address lookup | Google Maps / OpenStreetMap |
| Sign-in, sync to MongoDB | API calls |
| Server SOS alerts (Web Push / e-mail / webhook) and missed check-in alerts | Sent by the server |
| Online speech-to-text fallback (browsers without native recognition) | Optional, off by default |

SakhiAI never claims an internet-dependent feature works offline: when offline it shows "OFFLINE AVAILABLE / INTERNET REQUIRED" panels, disables or explains the affected feature, and keeps your data.

## Chat routing

```
User message
  → Rule Engine (emergency rules first)         ─┐
  → Intent Engine                                │ all local, instant,
  → Local Knowledge Base (en / hi / kn)         ─┘ NO network request
  → answered locally? ── yes ─→ reply
  → no → connectivity check
        ├─ offline / server unreachable → offline reply (lists topics that work offline, emergency numbers)
        └─ online → backend /api/chat → safety layer → Gemini (backend-owned model + key)
                                 └─ failure → safe localized fallback text
```
Implemented in `src/services/chatRouter.js`; proven by `chatRouter.test.js` (no `fetch` call for known questions; Gemini only for unknown questions when online).

## Safe synchronisation (outbox)

`src/services/syncQueue.js`:
1. Every change is saved locally first.
2. When signed in it is queued as an operation. If online it is sent immediately; otherwise it **stays queued** (persisted in `localStorage`, survives reloads).
3. When connectivity returns (browser `online` event, health ping, tab focus, or a 15–60 s timer) the queue flushes — **SOS first**, then oldest-first.
4. Network errors, timeouts, 5xx, 429 and expired sessions **keep** the operation. Only permanent client errors drop it, and the user is told.
5. Idempotency keys (`clientId`, `clientEventId`, per-day upserts) make replays safe; the server de-duplicates.
6. Server data is pulled only when nothing local is waiting, so local offline edits are never overwritten.

## Offline SOS

1. Countdown (cancel any time) → GPS fix (works offline; may be inaccurate/unavailable — SOS still proceeds).
2. The phone's SMS/WhatsApp composer opens (no data needed).
3. Signed-in: the SOS is queued (`PENDING`/`RETRYING`) and shown as *"Saved on this device — not sent yet"*. On reconnection it is sent with the original trigger time; contacts are told it was sent late.
4. Anonymous: *"No automatic alert was sent"* — nothing is claimed.
5. "I'm safe" on a still-queued SOS cancels it so it is never sent.

## PWA

* `public/manifest.webmanifest` + icons (installable, standalone, SOS shortcut).
* `public/sw.js`: precache at install, network-first navigation with offline fallback, cache-first hashed assets, push notifications. It **never** caches or intercepts `/api/*` or cross-origin requests.
* `scripts/verifyBuild.mjs` checks the production build (manifest, icons, service worker, precache list, no secrets); `src/sw.test.js` runs the service worker in a sandbox and proves offline navigation and API pass-through.
* Requires HTTPS in production (localhost is exempt for development).
