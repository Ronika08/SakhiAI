# Deployment

## Environment variables at a glance
`backend/env.example` marks every variable **[REQUIRED]**, **[REQUIRED-PROD]**, **[OPTIONAL]** or **[PROD]**. Minimum for production: `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET` (≥32 chars), `CORS_ALLOWED_ORIGINS`, `APP_URL`, `TRUST_PROXY`, and `GEMINI_API_KEY` (only needed for the AI fallback; the offline features need nothing). The frontend needs only `VITE_API_BASE_URL` at build time.

## Checklist
1. MongoDB (free: Atlas M0) → `MONGODB_URI`.
2. `JWT_SECRET` (≥ 32 random chars), `GEMINI_API_KEY`, `GEMINI_MODEL`.
3. `CORS_ALLOWED_ORIGINS` = exact frontend origin(s) (https), `APP_URL` = frontend URL.
4. `TRUST_PROXY=1` behind Render/Railway/Fly/Nginx.
5. Serve both over **HTTPS** (required for geolocation, service workers and push).
6. Run `cd backend && npm run validate:env` with production variables.
6b. Run `cd backend && npm run check:gemini` once to confirm the key/model work (prints the outcome, never the key).
7. Build the frontend with `VITE_API_BASE_URL=https://<backend>` → `npm run build` → host `dist/`.

## Option A — Render (free tier) using `render.yaml`
Create a Blueprint from the repo; fill every `sync: false` variable in the dashboard. Health check: `/health`.

## Option B — Docker
```bash
cp backend/env.example backend/.env   # edit
docker compose up --build             # frontend :8080, backend :5000, mongo
```

## Option C — any Node host + static host
Backend: `cd backend && npm ci --omit=dev && node server.js`. Frontend: any static host with SPA fallback to `index.html`; serve `sw.js` with `Cache-Control: no-cache`.

Backend shuts down gracefully on `SIGTERM`/`SIGINT` (closes HTTP then MongoDB, 10 s hard timeout). Probes: `/health` (liveness), `/ready` (readiness).

## SOS notification channels
All optional and free. If none are configured SOS honestly reports `NOT_CONFIGURED`. Use **Account → Send test alert** to verify before relying on it.

| Channel | Setup | Reaches |
|---|---|---|
| Webhook | `NOTIFY_WEBHOOK_URLS=https://ntfy.sh/<private-topic>` (or Discord/Slack/n8n URL), optional `NOTIFY_WEBHOOK_SECRET` | whoever subscribes to that topic/channel (e.g. family group) — once per alert |
| E-mail | `RESEND_API_KEY` + `EMAIL_FROM` **or** `SMTP_HOST/PORT/USER/PASS` + `EMAIL_FROM` | contacts with an e-mail address |
| Web Push | `npx web-push generate-vapid-keys` → `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:you@example.com` | the user's own devices + contacts who have a SakhiAI account with the same e-mail and enabled push |

Missed check-ins use the same providers (`services/checkInMonitor.js`, polls every minute while the server runs — on free hosts that sleep, a missed check-in is only processed when the server is awake; use an uptime pinger or an always-on host).

## Frontend hosting notes
Because the app is a PWA, deploy new versions with a changed bundle; the service worker updates on next load. HTTPS is mandatory for installability.

## Google Maps
The live-map and nearby-place links are keyless embeds. Route search uses the **server-side** `GOOGLE_MAPS_API_KEY` (Directions + Geocoding APIs). Create the key in Google Cloud, enable those two APIs, restrict it by API and by your server's IP, and set billing/quotas. The key is never sent to the browser. Quota errors surface as a friendly "maps service is busy" message.

## Health & readiness
`GET /health` (liveness, no dependencies) and `GET /ready` (database ping + configuration booleans; 503 when MongoDB is configured but unreachable). Point load-balancer/Render health checks at `/health`.

## CORS
Set `CORS_ALLOWED_ORIGINS` to the exact https origin(s) of the frontend, e.g. `https://sakhiai.example.com` (no trailing slash, comma-separated). Requests from any other origin get 403.

## PWA hosting checklist
HTTPS, `sw.js` and `manifest.webmanifest` served with `Cache-Control: no-cache` (see `nginx.conf` / `render.yaml`), SPA fallback to `index.html`, then run `npm run verify:build` before publishing `dist/`.
