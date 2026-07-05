# SakhiAI Backend

Backend API server for **SakhiAI** — *Your Trusted Women's Safety & Health Companion*.

Built with Node.js, Express, and MongoDB (via Mongoose). Provider-independent AI chat layer supports Anthropic, with OpenAI and Gemini registered as pending integrations.

## Getting Started

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure environment variables

Copy the example file and fill in real values:

```bash
cp .env.example .env
```

At minimum, set `ANTHROPIC_API_KEY` to enable AI chat, and `JWT_SECRET` to enable authentication. `MONGODB_URI` is optional in development — the server will start without it, but any route touching the database (auth, contacts, check-ins, SOS, cycles, moods) will fail until it's set.

See `.env.example` for the full list of supported variables.

### 3. Run the server

```bash
npm run dev    # auto-restarts on file changes (nodemon)
npm start      # plain node, for production
```

The server starts on `PORT` (default `5000`). Confirm it's running:

```bash
curl http://localhost:5000/health
```

## Project Structure

```
backend/
├── server.js                  # App entry point
├── config/
│   ├── index.js                # Centralized env-based configuration
│   └── db.js                   # MongoDB connection
├── middleware/
│   ├── errorHandler.js         # Global error handler + AppError class
│   └── authMiddleware.js       # JWT route protection
├── models/
│   ├── User.js
│   ├── EmergencyContact.js
│   ├── SafetyCheckIn.js
│   ├── EmergencySOS.js
│   ├── CycleLog.js
│   └── MoodLog.js
├── services/
│   ├── aiProvider.js            # Provider-independent AI dispatch (+ offline fallback)
│   ├── anthropicService.js      # Anthropic-specific implementation
│   ├── healthKnowledgeService.js# Offline knowledge base + AI fallback content
│   ├── authService.js
│   ├── emergencyContactService.js
│   ├── safetyCheckInService.js
│   ├── emergencySOSService.js
│   ├── cycleLogService.js
│   └── moodLogService.js
├── controllers/                 # HTTP request/response layer per feature
├── routes/                      # Route definitions, mounted in routes/index.js
└── utils/
    └── logger.js
```

## API Reference

All routes are prefixed with `/api`. Routes marked 🔒 require a JWT via `Authorization: Bearer <token>`.

### Health

| Method | Path      | Description                  |
| ------ | --------- | ----------------------------- |
| GET    | `/health` | Server liveness check (no `/api` prefix) |
| GET    | `/api`    | API index / resource list     |

### Auth (`/api/auth`)

| Method | Path        | Auth | Description             |
| ------ | ----------- | ---- | ------------------------ |
| POST   | `/register` |      | Create a new account     |
| POST   | `/login`    |      | Authenticate, receive JWT|
| GET    | `/me`       | 🔒   | Get current user profile |

### AI Chat (`/api/chat`)

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ------------ |
| POST   | `/`  |      | Send a message, get an AI (or offline fallback) reply |

### Trusted Circle (`/api/contacts`) — 🔒 all routes

| Method | Path   | Description             |
| ------ | ------ | ------------------------ |
| GET    | `/`    | List trusted contacts    |
| POST   | `/`    | Add a trusted contact    |
| PATCH  | `/:id` | Update a trusted contact |
| DELETE | `/:id` | Remove a trusted contact |

### Safety Check-In (`/api/checkins`) — 🔒 all routes

| Method | Path            | Description                |
| ------ | --------------- | --------------------------- |
| POST   | `/`             | Start a check-in            |
| GET    | `/`             | List check-ins              |
| GET    | `/:id`          | Get a single check-in       |
| PATCH  | `/:id/confirm`  | Confirm safe arrival        |
| PATCH  | `/:id/cancel`   | Cancel a pending check-in   |

### Emergency SOS (`/api/sos`) — 🔒 all routes

| Method | Path   | Description                  |
| ------ | ------ | ------------------------------ |
| POST   | `/`    | Trigger an SOS event           |
| GET    | `/`    | List past SOS events           |
| GET    | `/:id` | Get a single SOS event         |

### Cycle Tracker (`/api/cycles`) — 🔒 all routes

| Method | Path       | Description                         |
| ------ | ---------- | ------------------------------------- |
| POST   | `/`        | Log a new cycle                       |
| GET    | `/`        | List cycle logs                       |
| GET    | `/predict` | Predict next period start date        |
| GET    | `/:id`     | Get a single cycle log                |
| PATCH  | `/:id`     | Update a cycle log                    |
| DELETE | `/:id`     | Delete a cycle log                    |

### Mood Tracker (`/api/moods`) — 🔒 all routes

| Method | Path       | Description                    |
| ------ | ---------- | --------------------------------- |
| POST   | `/`        | Log a mood entry                  |
| GET    | `/`        | List mood logs (supports `?from=&to=`) |
| GET    | `/summary` | Mood frequency summary (`?days=`) |
| GET    | `/:id`     | Get a single mood log             |
| PATCH  | `/:id`     | Update a mood log                 |
| DELETE | `/:id`     | Delete a mood log                 |

### Health Tips (`/api/health-tips`) — public, no auth

| Method | Path      | Description                        |
| ------ | --------- | ------------------------------------- |
| GET    | `/`       | List tips (supports `?category=`)     |
| GET    | `/search` | Search tips (`?q=&limit=`)            |
| GET    | `/:id`    | Get a single tip                      |

## Error Response Shape

All errors are returned as:

```json
{
  "success": false,
  "message": "Human-readable explanation"
}
```

## Pending Features

- Google Maps / Safe Route API integration
- Voice input / output
- Push/SMS notifications for SOS and missed check-ins (currently logged only)
- OpenAI and Gemini AI provider implementations
