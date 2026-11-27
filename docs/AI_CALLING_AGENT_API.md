# NORTHSTAR — AI Calling Agent API Contract Reference

*Navigate Commerce with Clarity.*

All merchant endpoints are prefixed with `/api/v1/calling`, require a workspace-scoped Bearer JWT, and enforce strict `merchant_id` tenant isolation via `TenantContextHolder`.

---

## 1. Merchant Calling Intelligence Endpoints

### `GET /api/v1/calling/overview`
- **Minimum Role:** `VIEWER`
- **Returns:** Workspace-scoped KPI summary (`totalCodOrdersRequiringVerification`, `callsQueuedOrScheduled`, `callsInitiated`, `callsCompleted`, `confirmedOrders`, `rejectedOrders`, `unansweredCalls`, `cancellationRequests`, `escalatedCalls`, `failedCalls`, `inDndWindowNow`, `activeProvider`).

### `GET /api/v1/calling/sessions`
- **Minimum Role:** `VIEWER`
- **Query Parameters:**
  - `search` *(optional)* — matches order number, buyer name, or phone
  - `status` *(optional)* — `QUEUED`, `DISPATCHING`, `IN_PROGRESS`, `RETRY_SCHEDULED`, `COMPLETED`, `ESCALATED`, `STOPPED`, `FAILED`
  - `outcome` *(optional)* — `CONFIRMED`, `REJECTED`, `CANCELLATION_REQUESTED`, `NO_ANSWER`, `BUSY`, `UNCERTAIN`, `INVALID_NUMBER`, `HUMAN_ESCALATION`, `CALL_FAILED`
  - `riskBand` *(optional)* — `LOW`, `MEDIUM`, `HIGH`
  - `fromDate`, `toDate` *(optional, ISO-8601)*
  - `page` (`0`), `size` (`20`), `sortBy` (`createdAt`), `sortDir` (`desc`)

### `GET /api/v1/calling/sessions/{sessionId}`
- **Minimum Role:** `VIEWER`
- **Returns:** `CallSessionDetailDto` containing session summary, order line items, shipping address, AI summary, buyer intent, DNC status, 4-pillar `rtoAssessment`, `attempts[]`, `transcript[]`, and `timeline[]`.

### `POST /api/v1/calling/sessions/{sessionId}/retry`
- **Minimum Role:** `OPERATOR`
- **Body (optional):** `{ "preferredLanguage": "hi-IN" }`
- **Behavior:** Initiates or retries an outbound call if no attempt is currently active and the customer has not requested cancellation or opted out.

### `POST /api/v1/calling/sessions/{sessionId}/stop`
- **Minimum Role:** `OPERATOR`
- **Body (optional):** `{ "reason": "Manual hold", "optOutCustomer": true }`
- **Behavior:** Disables future automated retries for the session and optionally adds the buyer to the workspace DNC list.

### `POST /api/v1/calling/sessions/{sessionId}/escalate`
- **Minimum Role:** `OPERATOR`
- **Body (optional):** `{ "reason": "Buyer asked exchange policy question" }`
- **Behavior:** Marks the session `ESCALATED` (`HUMAN_ESCALATION`), stops automated retries, records a `CustomerBehaviouralEvent`, and updates RTO risk.

### `POST /api/v1/calling/sessions/{sessionId}/simulate-outcome`
- **Minimum Role:** `OPERATOR`
- **Body:** `{ "outcome": "CONFIRMED", "durationSeconds": 48, "language": "hi-IN", "customerOptOut": false }`
- **Behavior:** Executes the full outcome-processing, transcript persistence, order status transition, Customer 360 event, and 4-pillar RTO scoring pipeline in `SANDBOX` mode without placing real phone calls.

### `POST /api/v1/calling/sync-eligible-orders?dispatchImmediate=true`
- **Minimum Role:** `OPERATOR`
- **Behavior:** Idempotently enrolls any existing `CREATED` COD orders in the active merchant workspace that do not yet have a `call_sessions` row.

### `GET /api/v1/calling/orders/{orderId}/rto-assessment`
- **Minimum Role:** `VIEWER`
- **Returns:** Four-pillar `RtoRiskAssessmentDto` (`behaviouralRiskPoints`, `orderRiskPoints`, `callingOutcomePoints`, `historicalConfirmationPoints`, `totalRiskScore`, `riskBand`, `reasons[]`, `recommendedAction`).

### `GET /api/v1/calling/configuration` & `PUT /api/v1/calling/configuration`
- **Minimum Role:** `VIEWER` (`GET`), `ADMIN` (`PUT`)
- **Manages:** Provider selection, default/supported languages, retry limits, backoff intervals, TRAI DND hours, and automatic order transition flags.

---

## 2. Provider Webhook Contract (`POST /api/v1/calling/webhooks/provider`)

- **Authentication:**
  - `X-Northstar-Timestamp`: Unix epoch seconds (must be within ±300 seconds of server UTC clock)
  - `X-Northstar-Signature`: `sha256=<hex(HMAC_SHA256(secret, timestamp + "." + rawBody))>`
- **Payload Example:**
```json
{
  "eventId": "voice-9d8a12f4-001",
  "eventType": "CALL_COMPLETED",
  "callSessionId": "c6f3e0b8-3b9b-4e7c-9e77-92d2c319f812",
  "callAttemptId": "91a8b120-21cc-43b9-8f41-101928374655",
  "providerCallId": "lk-sip-884120ab",
  "roomName": "northstar-cod-ORD-1024-att1",
  "outcome": "CONFIRMED",
  "durationSeconds": 51,
  "aiSummary": "Buyer confirmed ordering Kumkumadi Serum (Qty 1, INR 1599 COD) and confirmed availability at Gurugram address.",
  "customerIntent": "Confirmed Order",
  "customerOptOut": false,
  "transcriptTurns": [
    { "turnIndex": 0, "role": "AGENT", "text": "Namaste...", "language": "hi-IN", "confidence": 0.99 },
    { "turnIndex": 1, "role": "CUSTOMER", "text": "Haan ji bhej dijiye.", "language": "hi-IN", "confidence": 0.95 }
  ]
}
```
- **Idempotency:** Duplicate deliveries with the same `eventId` return `200 OK` with `{"applied": false, "idempotentReplay": true}` without mutating state.
