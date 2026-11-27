# NORTHSTAR — AI Calling Agent Setup & Operations Guide

*Navigate Commerce with Clarity.*

---

## 1. Prerequisites

- **Java 17+ / 21 LTS** & Maven Wrapper (`server/mvnw.cmd`)
- **Node.js 20+** (for Frontend Vite dev server and `voice-service`)
- **PostgreSQL** (Supabase Cloud PostgreSQL or Local PostgreSQL 16+)

---

## 2. Environment Variables

Copy `.env.example` to `.env` (gitignored) and configure as needed:

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `CALLING_ENABLED` | `true` | Enables automatic COD order enrollment into the calling queue |
| `CALLING_PROVIDER` | `SANDBOX` | `SANDBOX` (safe zero-PSTN simulator) or `VOICE_SERVICE` (Node.js LiveKit/Sarvam bridge) |
| `CALLING_VOICE_SERVICE_URL` | `http://127.0.0.1:3104` | Base URL of the stateless `voice-service` |
| `CALLING_WEBHOOK_SECRET` | *(32+ byte secret)* | Shared HMAC-SHA256 signing secret between Spring Boot and `voice-service` |
| `CALLING_SCHEDULER_ENABLED` | `true` | Enables background queue dispatch & timeout sweeper |
| `CALLING_SCHEDULER_INTERVAL_MS` | `15000` | Scheduler polling interval in milliseconds |
| `CALLING_DISPATCH_MODE` | `DRY_RUN` | `DRY_RUN` (no PSTN calls) or `LIVE` (places real SIP calls via LiveKit) |
| `LIVEKIT_URL` | *(empty)* | LiveKit Cloud WebSocket URL (`wss://...`) for `LIVE` mode |
| `LIVEKIT_API_KEY` | *(empty)* | LiveKit API key |
| `LIVEKIT_API_SECRET` | *(empty)* | LiveKit API secret |
| `LIVEKIT_SIP_TRUNK_ID_VOBIZ` | *(empty)* | DLT-registered Indian `+91` outbound SIP trunk ID in LiveKit |
| `LIVEKIT_SIP_TRUNK_ID_TWILIO` | *(empty)* | International E.164 outbound SIP trunk ID in LiveKit |
| `SARVAM_API_KEY` | *(empty)* | Sarvam AI key for `saaras:v3` STT & `bulbul:v3` TTS |
| `OPENAI_API_KEY` | *(empty)* | OpenAI key for `gpt-4o-mini` LLM & `gpt-4o-transcribe` English STT |

> [!CAUTION]
> Keep `CALLING_PROVIDER=SANDBOX` and `CALLING_DISPATCH_MODE=DRY_RUN` during development and testing so real customer phone numbers are never dialed accidentally.

---

## 3. Running Locally (Sandbox & Dry-Run Mode)

### Step 1 — Start Spring Boot Backend
Flyway automatically applies `V5__ai_calling_agent.sql`:
```powershell
cd server
.\mvnw.cmd spring-boot:run
```

### Step 2 — Start Stateless Voice Service (Optional in `SANDBOX`, Required for `VOICE_SERVICE`)
```powershell
cd voice-service
node src/server.js
```
Verify voice gateway health:
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:3104/health"
```

### Step 3 — Start React Frontend
```powershell
npm run dev
```
Navigate to `http://127.0.0.1:5173/app/calling` (**Calling Intelligence**).

---

## 4. Enabling Production Calling (`LIVE` Mode)

1. Provision a **LiveKit Cloud** project and configure a DLT-registered Indian SIP outbound trunk (**Vobiz** / Exotel) for `+91` traffic (`LIVEKIT_SIP_TRUNK_ID_VOBIZ`).
2. Obtain **Sarvam AI** (`SARVAM_API_KEY`) and **OpenAI** (`OPENAI_API_KEY`) credentials.
3. Generate a strong 32+ byte cryptographic `CALLING_WEBHOOK_SECRET` and configure it identically on both `server` and `voice-service`.
4. Install worker dependencies and start both the HTTP gateway and LiveKit agent worker:
   ```bash
   cd voice-service
   npm install
   CALLING_DISPATCH_MODE=LIVE node src/server.js &
   node src/livekit-worker.js start
   ```
5. Switch the merchant workspace policy in **Calling Intelligence → Calling Policy** (or `CALLING_PROVIDER=VOICE_SERVICE`) from `SANDBOX` to `VOICE_SERVICE`.
