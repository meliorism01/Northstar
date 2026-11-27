# NORTHSTAR — AI Calling Agent Testing & Verification Guide

*Navigate Commerce with Clarity.*

---

## 1. Safety Rule: Zero Real Customer Calls During Testing

By default:
- Spring Boot runs with `CALLING_PROVIDER=SANDBOX` (`SandboxVoiceCallingProvider`).
- `voice-service` runs with `CALLING_DISPATCH_MODE=DRY_RUN`.

Neither component dials PSTN numbers unless `CALLING_PROVIDER=VOICE_SERVICE` **and** `CALLING_DISPATCH_MODE=LIVE` are explicitly configured with valid SIP trunk credentials.

---

## 2. Automated Backend Unit & Integration Tests

Run the complete Maven test suite from `server/`:

```powershell
cd server
.\mvnw.cmd test -B
```

### Scenarios Covered Automatically
1. **Universal COD Enrollment (`CallingAgentIntegrationTest`)**:
   - Verifies a **Low-Risk** COD order (`Rs 499`, complete address) enters the calling queue.
   - Verifies a **High-Risk** COD order (`Rs 4,999`, incomplete address) enters the calling queue.
   - Verifies a **Prepaid** order does **not** enter the COD calling queue.
2. **Duplicate Event Idempotency**:
   - Re-publishing `OrderCreatedForCallingEvent` for the same order produces zero duplicate `call_sessions` or `call_attempts`.
   - Re-sending an identical signed webhook (`eventId`) returns `idempotentReplay: true` with zero duplicate transcripts or status transitions.
3. **Signed Webhook Security**:
   - Missing or invalid `X-Northstar-Signature` is rejected with `401 WEBHOOK_SIGNATURE_INVALID`.
   - Expired `X-Northstar-Timestamp` (> 5 minutes skew) is rejected.
4. **End-to-End Outcome Processing**:
   - `CONFIRMED` → Transitions order `CREATED -> CONFIRMED`, records `OrderStatusHistory`, records `CALL_VERIFICATION_CONFIRMED` in Customer 360, and lowers RTO score (`CALL_CONFIRMED_INTENT`).
   - `NO_ANSWER` → Transitions session to `RETRY_SCHEDULED` with `nextAttemptAt` populated and neutral `0` calling risk penalty.
   - `REJECTED` → Marks `doNotCallFurther = true`, records `CALL_VERIFICATION_REJECTED`, and raises RTO risk band to `HIGH` (`CALL_DENIED_ORDER`).
   - `CANCELLATION_REQUESTED` + `customerOptOut` → Stops future calls immediately, marks customer DNC opt-out, and rejects subsequent `/retry` attempts (`422 CALL_ACTION_NOT_ALLOWED`).
5. **Multi-Tenant Isolation**:
   - Merchant B attempting to read or mutate Merchant A's `sessionId` receives `404 RESOURCE_NOT_FOUND`.
6. **TRAI DND Window & 4-Pillar RTO Unit Tests (`CallingDndAndRtoUnitTest`)**:
   - Verifies `22:30 IST` rolls forward to `09:05 IST` next morning while `14:00 IST` dispatches immediately.

---

## 3. Frontend Build Verification

```powershell
npm run build
```

---

## 4. Interactive End-to-End Sandbox Walkthrough

1. Sign in to `http://127.0.0.1:5173/login` and open **Order Management** (`/app/orders`).
2. Create a new order with Payment Method = `COD` (any value/risk).
3. Open **Calling Intelligence** (`/app/calling`) from the left sidebar.
4. Confirm the new COD order appears in the queue immediately.
5. Click **Inspect** on the row to open the Call Session Drawer, and use the **Sandbox Outcome Simulator** buttons (`Simulate Confirmed`, `Simulate No Answer`, `Simulate Rejected`, `Simulate Cancellation`) to verify live transcript rendering, order status updates, and 4-pillar RTO score explanations.
