# API reference

Base URL: `http://localhost:5000`. JSON in/out. Authenticated routes need `Authorization: Bearer <accessToken>`.
Success: `{ "success": true, "data": … }`. Error: `{ "success": false, "message", "code", "requestId", "details?" }`.
Every response carries `X-Request-Id`.

### Error codes
`VALIDATION_ERROR` 400 · `AUTHENTICATION_ERROR` / `TOKEN_EXPIRED` 401 · `AUTHORIZATION_ERROR` 403 · `NOT_FOUND` 404 · `CONFLICT` 409 · `PAYLOAD_TOO_LARGE` 413 · `RATE_LIMITED` 429 · `AI_UNAVAILABLE` 502/503 · `AI_TIMEOUT` 504 · `AI_RATE_LIMITED` 429 · `AI_BLOCKED` 422 · `AI_BAD_RESPONSE` 502 · `DATABASE_ERROR` 503 · `LOCATION_ERROR` 400 · `MAP_ERROR` · `NETWORK_ERROR` · `SERVER_ERROR` 500.

## Operations
| Method | Path | Notes |
|---|---|---|
| GET | `/health` | liveness |
| GET | `/ready` | readiness: DB ping + config booleans (503 when DB configured but down) |

## Chat (public, rate-limited)
`POST /api/chat` body `{ messages: [{role:"user"|"assistant", content}], language?: "en"|"hi"|"kn" }` (`language` only picks the reply language) → `{ success, response, provider, usage, safety }`.
`provider` is `"gemini"` or `"safety-engine"` (vetted reply, AI not called). Client fields `model`, `system`, `provider`, `max_tokens` are **ignored**. On AI failure: `{ success:false, error, code, fallbackResponse, requestId }`.

## Auth `/api/auth`
| Method | Path | Body / notes |
|---|---|---|
| POST | `/register` | `{name,email,password}` → `{user, token, refreshToken, expiresIn}` |
| POST | `/login` | `{email,password}`; 5 failures lock 15 min |
| POST | `/refresh` | `{refreshToken}` → rotated tokens (reuse revokes the family) |
| POST | `/logout` | `{refreshToken}` or `{allDevices:true}` (with bearer) |
| POST | `/forgot-password` | `{email}` – identical response for unknown e-mails |
| POST | `/reset-password` | `{token,newPassword}` single use |
| GET/PATCH | `/me` | profile, preferences, healthPreferences |
| POST | `/change-password` | `{currentPassword,newPassword}` |

Password policy: 8–128 chars, a letter and a digit, not common, must not contain the e-mail name.

## Voice (optional online fallback)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/voice/status` | `{ serverSttEnabled }` |
| POST | `/api/voice/transcribe` | `{audioBase64, mimeType, language?}` → `{text}`. 503 unless `VOICE_STT_ENABLED=true`; audio is not stored or logged |

## Data (all require auth)
| Resource | Endpoints |
|---|---|
| Contacts `/api/contacts` | `GET /`, `POST /`, `PATCH /:id`, `DELETE /:id` — `{name,phone,email?,relation?,isPrimary?,notifyOn:{sos,checkInMissed}}`; one primary; max 10 |
| Cycles `/api/cycles` | `POST /` (accepts an idempotency `clientId`), `GET /`, `GET /predict`, `GET/PATCH/DELETE /:id` — `{startDate,endDate?,cycleLengthDays?,flow?,symptoms?,notes?}` |
| Moods `/api/moods` | `POST /` (accepts `clientId`), `GET /`, `GET /summary`, `GET/PATCH/DELETE /:id` |
| Wellness `/api/wellness` | `GET /?from&to&limit`, `GET /summary?days=7`, `PUT /:date` `{waterGlasses,sleepHours,sleepBucket,activityMinutes,stressLevel,mood,note}`, `DELETE /:id` |
| Check-ins `/api/checkins` | `POST /`, `GET /`, `GET /:id`, `PATCH /:id/confirm`, `PATCH /:id/cancel` — missed check-ins alert contacts via the notification providers |
| SOS `/api/sos` | `POST /` `{latitude?,longitude?,accuracy?,locationTimestamp?,deviceInfo?,clientEventId?,clientTriggeredAt?}` → `{sosEvent, delivery:{notificationStatus,notificationMessage}}` (idempotent by `clientEventId`; GPS optional); `GET /`, `GET /:id`, `POST /:id/resolve {notifySafe}`, `POST /:id/cancel` |
| Notifications `/api/notifications` | `GET /status` (public, booleans + VAPID public key), `POST/DELETE /push/subscribe`, `POST /test` |
| Safe route `/api/routes/plan` | `POST` `{origin,destination,mode}` where each is `{lat,lng}` or `{address}` (geocoded server-side); auth + `GOOGLE_MAPS_API_KEY` |
| Health tips `/api/health-tips` | public `GET /`, `/search`, `/:id` |

Database-backed routes return `503 DATABASE_ERROR` immediately when MongoDB is not connected; chat and health tips keep working.
