# Security

| Concern | Implementation |
|---|---|
| Secrets | Only in `backend/.env` (git-ignored). Frontend only knows `VITE_API_BASE_URL`. CI scans the bundle and repo for key patterns. Gemini key is sent in a header, never in a URL, never logged |
| AI configuration | Provider/model/system prompt/limits are backend-owned; client `model`/`system`/`provider` are ignored |
| Auth | bcrypt (configurable rounds), HS256 JWT access tokens (15 m), opaque refresh tokens stored as SHA-256 hashes, rotation + reuse detection, logout/all-device logout, lockout (5 fails → 15 min), constant-time-ish login for unknown users, enumeration-safe forgot-password, single-use expiring reset tokens, password policy |
| Authorization | `protect`/`authorize(role)`; every query is scoped by `user` so one user cannot read another's data |
| HTTP hardening | Helmet (strict CSP `default-src 'none'`, HSTS in prod), strict CORS allow-list, 100 KB body limit, `x-powered-by` off, compression |
| Input | Schema checks in controllers, NoSQL-operator/prototype-key stripping, control-character removal, GPS validation, mongoose validators |
| Rate limiting | Global API, auth, password reset, chat, SOS limiters (per IP; set `TRUST_PROXY` behind a proxy) |
| Prompt injection | Pattern interception before AI, untrusted-input rule in system prompt, client `system`/roles rejected, reply validation blocks prompt leakage |
| Medical safety | Emergency/self-harm/dosage interception, dosage text blocked in replies, diagnosis disclaimers |
| Errors | Categorised codes; stack traces/provider messages never sent to clients; request IDs for support |
| Logging | Request ID, method, path, status, duration, provider, user ID; automatic redaction of bearer tokens, JWTs, API keys, passwords; no message bodies |
| Webhooks | URLs only from server env (no SSRF), https required in production, optional HMAC signature |
| Voice | Native speech recognition first; optional server STT is off by default, rate limited, size/type validated, audio never stored or logged, transcript is only returned to be edited |
| Offline queue | Idempotency keys prevent duplicates; queued data stays on the device (`localStorage`) until synced — avoid sharing a device profile |
| PWA | Service worker never caches `/api/*` or cross-origin requests |

## Known trade-offs
- The refresh token lives in `localStorage` so sessions survive reloads; an XSS bug could steal it. The strict API CSP and React's escaping reduce risk; for higher assurance move it to an `HttpOnly; Secure; SameSite` cookie (same-site deployment) — the server-side rotation logic already supports it.
- Rate limiting is in-memory per instance; use a shared store (Redis) if you scale horizontally.
- Rule-based AI safety is conservative but not exhaustive.
