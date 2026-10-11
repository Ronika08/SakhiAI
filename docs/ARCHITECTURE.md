# SakhiAI Architecture

## System overview

```mermaid
flowchart LR
  subgraph Browser["Browser / PWA"]
    UI[React + Vite UI]
    RE[Rule Engine] --> IE[Intent Engine]
    LS[(localStorage<br/>anonymous data)]
    SW[Service worker<br/>offline shell + push]
  end
  subgraph API["Express API (backend/)"]
    MW[requestContext → helmet → CORS → body limit → sanitize → rate limit]
    CH[chatController] --> SAFE[chatSafetyService]
    SAFE --> AP[aiProvider]
    AP --> GS[geminiService]
    AP -.optional.-> AN[anthropicService]
    SOS[SOS / check-in services] --> NS[notificationService]
    NS --> P1[webPushProvider]
    NS --> P2[emailProvider]
    NS --> P3[webhookProvider]
  end
  UI --> RE
  IE -- no match --> MW
  UI -- signed in --> MW
  GS --> G[(Google Gemini API)]
  P1 --> PS[(Browser push services)]
  P2 --> EM[(Resend / SMTP)]
  P3 --> WH[(ntfy / Discord / Slack / n8n)]
  API --> DB[(MongoDB)]
```

## Frontend
- `src/SakhiAI.jsx` – state hub and screen switch (unchanged architecture). Anonymous users read/write **localStorage**; signed-in users additionally sync through `src/services/dataApi.js` ("backend when signed in, localStorage always as the local cache").
- `src/services/apiClient.js` – only HTTP client: base URL from `VITE_API_BASE_URL`, in-memory access token, single-flight refresh, normalised `ApiError`.
- `src/context/AuthContext.jsx` – optional authentication; `pages/AuthPage.jsx` – sign-in/up/forgot/reset, notification-channel status and test alert.
- `src/services/locationService.js` – geolocation with typed errors (`PERMISSION_DENIED`, `TIMEOUT`, …), accuracy classes, coordinate validation.
- Accessible building blocks: `Toast`, `ConfirmDialog`, `Skeleton`, `SOSStatus`, `LocationProblem`.
- PWA: `public/manifest.webmanifest`, `public/sw.js`, `public/offline.html`, `src/services/pwa.js`.

## Backend
`server.js` (process: DB connect, listen, monitor, graceful shutdown) → `app.js` (middleware + routes) → `routes/` → `controllers/` (validation + HTTP) → `services/` (logic) → `models/` (Mongoose).

## Offline-first chat (current)
See [`OFFLINE.md`](OFFLINE.md). The diagram below shows the **server** half; the browser answers from the Rule Engine, Intent Engine and the local knowledge base first and only contacts the server when it cannot answer locally and the connectivity check passes.

## Hybrid chat (server half)

```mermaid
sequenceDiagram
  participant U as User
  participant F as Frontend
  participant B as Backend /api/chat
  participant S as chatSafetyService
  participant G as Gemini
  U->>F: message
  F->>F: Rule Engine → Intent Engine
  alt rule/intent matched
    F-->>U: immediate reply (no network)
  else no match
    F->>B: { messages }
    B->>S: prepareConversation + assessMessage
    alt emergency / self-harm / dosage / injection
      S-->>B: vetted safe reply (AI NOT called)
    else
      B->>G: backend system prompt + trimmed history (backend-owned model)
      G-->>B: reply
      B->>S: validateReply (dosage, leak, diagnosis)
    end
    B-->>F: { success, response, provider, safety }
    F-->>U: reply (or server-provided safe fallback on failure)
  end
```

## SOS flow

```mermaid
sequenceDiagram
  participant U as User
  participant F as Frontend
  participant B as Backend
  participant N as notificationService
  U->>F: tap SOS
  F->>F: confirmation + 5 s countdown (cancel anytime)
  F->>F: getPreciseLocation (permission/timeout/accuracy handled; (0,0) rejected)
  F->>U: opens SMS + WhatsApp composers (user must press Send)
  opt signed in
    F->>B: POST /api/sos {lat,lng,accuracy,clientEventId}
    B->>B: create event (location optional)
    B->>N: dispatchAlert(contacts)
    N-->>B: per-attempt SENT / FAILED / NO_RECIPIENT / NOT_CONFIGURED
    B-->>F: event + honest delivery message
    F-->>U: status panel, retry, call 112, "I'm safe"
  end
```

Honest statuses: `SENT` = a provider **accepted** the alert (never "delivered"); `FAILED`; `NOT_CONFIGURED`; `NO_RECIPIENT`; `NO_CONTACTS`; `PENDING`. A contact appears in `contactsNotified` only if a provider accepted an alert for them.

## Adding a notification provider
Create `backend/services/notificationProviders/<name>Provider.js` implementing `{ name, channel, perContact, isConfigured(), canReach?(contact, ctx), send({ contact, alert, userId }) → { status, detail } }` and add it to the `PROVIDERS` array in `notificationService.js`. SOS logic is untouched.

## Offline matrix

| Works offline | Needs internet |
|---|---|
| App shell, cycle/wellness/mood logs (localStorage), Trusted Circle view, rule/intent chat answers, emergency phone numbers (`tel:`), SMS composer on the phone | AI answers, maps & address lookup, sign-in/sync, server SOS alerts, check-in server alerts, push |
