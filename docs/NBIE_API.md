# NORTHSTAR — NBIE REST API Reference

**Base Path:** `/api/v1/interventions`  
**Authentication:** Bearer JWT (`Authorization: Bearer <accessToken>`) with an active selected merchant workspace (`TenantContextHolder`).  
**Envelope:** Standard NORTHSTAR `ApiResponse<T>` (`success`, `message`, `data`, `errorCode`, `timestamp`).

> **Authority Contract:** None of these endpoints accept a client-supplied `merchantId`, risk score, consent status, or customer history as evaluation input. None of these endpoints approve, decline, cancel, hold, or release an order.

---

## 1. Endpoints Summary

| Method | Path | Minimum Role | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/interventions/overview` | `VIEWER` | Merchant NBIE queue KPIs, active ruleset version, and sandbox safety flag |
| `POST` | `/api/v1/interventions/orders/{orderId}/evaluate` | `OPERATOR` | Evaluate order server-side and idempotently persist NBIE recommendation |
| `GET` | `/api/v1/interventions/orders/{orderId}/recommendations` | `VIEWER` | List recommendation history for a merchant order (`evaluatedAt DESC`) |
| `GET` | `/api/v1/interventions/recommendations/{recommendationId}` | `VIEWER` | Full recommendation detail + approvals, sandbox executions, outcomes, and audit trail |
| `GET` | `/api/v1/interventions/queue` | `VIEWER` | Paginated merchant queue filtered by bucket, status, intervention type, priority, and search |
| `POST` | `/api/v1/interventions/items/{itemId}/approve` | `OPERATOR` | Approve an **intervention action** only (`ACTION_APPROVED`); order status unchanged |
| `POST` | `/api/v1/interventions/items/{itemId}/reject` | `OPERATOR` | Reject an **intervention action** only (`ACTION_REJECTED`); order status unchanged |
| `POST` | `/api/v1/interventions/items/{itemId}/execute` | `OPERATOR` | Execute an `ACTION_APPROVED` item via sandbox adapter after runtime consent/policy re-check |
| `POST` | `/api/v1/interventions/items/{itemId}/outcomes` | `OPERATOR` | Record structured outcome (`verifiedResponse` vs inconclusive) and optionally refresh NBIE |
| `POST` | `/api/v1/interventions/recommendations/{id}/refresh` | `OPERATOR` | Force fresh NBIE re-evaluation and supersede outdated active record |
| `GET` | `/api/v1/interventions/policy` | `VIEWER` | Retrieve merchant NBIE policy configuration |
| `PUT` | `/api/v1/interventions/policy` | `ADMIN` | Update merchant NBIE policy configuration |
| `GET` | `/api/v1/interventions/customers/{customerId}/consent` | `VIEWER` | Inspect effective customer communication consent & DNC status |
| `PUT` | `/api/v1/interventions/customers/{customerId}/consent` | `OPERATOR` | Record verified customer communication consent provenance (`GRANTED`, `DENIED`, `UNKNOWN`) |

---

## 2. Core Contracts

### 2.1 Evaluate Order — `POST /api/v1/interventions/orders/{orderId}/evaluate`
- **Query Param:** `forceRefresh` (`boolean`, default `false`). When `false`, returns the existing active recommendation idempotently if the SHA-256 evidence + ruleset fingerprint has not changed.
- **Response (`data` — `RecommendationResponseDto`):**
```json
{
  "recommendationId": "8f2b9d14-5c3e-41d2-9f41-1029384756ab",
  "orderUuid": "29d81dbc-84fa-427e-8c43-47859fe65fce",
  "orderId": "ORD-17242",
  "currentOrderStatus": "CREATED",
  "paymentMethod": "COD",
  "orderValue": 1899.00,
  "currency": "INR",
  "customerId": "54e12a99-12ab-4c32-8871-998877665544",
  "customerName": "Fixture Buyer",
  "maskedPhone": "+91 98••••3344",
  "status": "ACTION_APPROVAL_PENDING",
  "evaluationStatus": "COMPLETED",
  "riskSnapshot": {
    "score": 52,
    "band": "MEDIUM",
    "behaviouralPoints": 0,
    "orderPoints": 52,
    "callingOutcomePoints": 0,
    "historicalConfirmationPoints": 0,
    "reasonCodes": ["ADDRESS_INCOMPLETE", "CONFIRMATION_PENDING"],
    "assessedAt": "2026-11-27T06:30:00Z"
  },
  "primaryRecommendation": {
    "itemId": "c1234567-89ab-4def-8123-456789abcdef",
    "role": "PRIMARY",
    "rankOrder": 1,
    "type": "COD_CONFIRMATION",
    "priority": "MEDIUM",
    "status": "ACTION_APPROVAL_PENDING",
    "proposedChannel": "VOICE_SANDBOX",
    "triggeredRuleIds": ["NBIE-COD-001"],
    "reasonCodes": ["CONFIRMATION_PENDING"],
    "explanation": "Confirm customer intent and delivery availability for this Cash-on-Delivery order.",
    "requiredEvidence": ["cod_intent_confirmation"],
    "approvalRequired": true
  },
  "secondaryRecommendations": [
    {
      "itemId": "d7654321-89ab-4def-8123-456789abcdef",
      "role": "SECONDARY",
      "rankOrder": 2,
      "type": "ADDRESS_CLARIFICATION",
      "priority": "MEDIUM",
      "status": "ACTION_APPROVAL_PENDING",
      "proposedChannel": "VOICE_SANDBOX",
      "triggeredRuleIds": ["NBIE-ADDR-001"],
      "reasonCodes": ["ADDRESS_INCOMPLETE", "LANDMARK_MISSING"],
      "explanation": "Request only the missing or ambiguous delivery address details (landmark) to reduce failed doorstep locate attempts.",
      "requiredEvidence": ["landmark"],
      "approvalRequired": true
    }
  ],
  "evidenceCompleteness": "HIGH",
  "evidenceSnapshot": {
    "addressFormulaVersion": "ADDRESS_COMPLETENESS_V1",
    "addressCompleteness": "INCOMPLETE",
    "pinValidityState": "VALID",
    "landmarkPresence": "MISSING",
    "missingAddressFields": ["landmark"],
    "coldStartCustomer": true,
    "priorCodSuccessRate": null,
    "consentStatus": "GRANTED",
    "unknownDataWarnings": [
      "VERIFIED_RTO_TELEMETRY_UNAVAILABLE_IN_SCHEMA",
      "PRIOR_COD_SUCCESS_RATE_UNKNOWN_ZERO_DENOMINATOR"
    ]
  },
  "rulesetVersion": "NBIE_RULESET_V1",
  "authorityNotice": "NBIE recommends pre-dispatch interventions only. It never approves, declines, cancels, holds, or releases an order. Approving an action authorizes that intervention only.",
  "activeRecord": true,
  "evaluatedAt": "2026-11-27T06:30:00Z",
  "expiresAt": "2026-11-28T06:30:00Z"
}
```

### 2.2 Queue Filtering — `GET /api/v1/interventions/queue`
- **Query Parameters:**
  - `bucket`: `ACTIVE` | `AWAITING_APPROVAL` | `AWAITING_EXECUTION_OR_OUTCOME` | `RECENTLY_COMPLETED` | `ALL_HISTORY`
  - `status`: `InterventionStatus` enum
  - `type`: `COD_CONFIRMATION` | `ADDRESS_CLARIFICATION` | `HUMAN_REVIEW` | `OPTIONAL_PARTIAL_ADVANCE` | `NO_INTERVENTION`
  - `priority`: `HIGH` | `MEDIUM` | `LOW` | `NONE`
  - `search`: Case-insensitive substring on `orderNumber` or `customer.fullName`
  - `page` (default `0`), `size` (default `15`), `sortBy` (`evaluatedAt` | `createdAt` | `rtoScore` | `expiresAt`), `sortDir` (`asc` | `desc`)

### 2.3 Approve / Reject Action — `POST /api/v1/interventions/items/{itemId}/approve` & `/reject`
```json
{
  "note": "Authorized sandbox COD confirmation outreach"
}
```
- **Effect:** Updates `InterventionRecommendationItem.status` to `ACTION_APPROVED` or `ACTION_REJECTED`, writes an immutable `InterventionApproval` + `InterventionAuditEvent`, and leaves `Order` completely untouched.

### 2.4 Execute Intervention — `POST /api/v1/interventions/items/{itemId}/execute`
```json
{
  "idempotencyKey": "exec-ord-17242-cod-1",
  "note": "Dispatch via sandbox adapter"
}
```
- **Preconditions:** Item must be `ACTION_APPROVED` (or `EXECUTION_PENDING`), not expired/superseded, and pass real-time consent, DNC, contact-cap, lifecycle, and `SANDBOX` provider checks.
- **Postcondition:** Item moves to `OUTCOME_PENDING` (sandbox dispatch acknowledgment is **not** customer confirmation).

### 2.5 Record Outcome — `POST /api/v1/interventions/items/{itemId}/outcomes`
```json
{
  "outcomeType": "CUSTOMER_CONFIRMED_INTENT",
  "idempotencyKey": "outcome-ord-17242-1",
  "outcomeSource": "OPERATOR_RECORDED",
  "resolvedFields": ["cod_intent_confirmation"],
  "triggerReEvaluation": true
}
```

---

## 3. Error Codes & HTTP Status Mapping

| HTTP Status | `errorCode` | Trigger Scenario |
| :--- | :--- | :--- |
| `400 Bad Request` | `VALIDATION_ERROR` | Malformed request body, invalid enum/channel, or pagination out of bounds |
| `401 Unauthorized` | `UNAUTHORIZED` | Missing, expired, or invalid JWT access token |
| `403 Forbidden` | `ACCESS_DENIED` / `TENANT_ACCESS_DENIED` | Insufficient workspace role (e.g., `VIEWER` calling `POST /evaluate` or `OPERATOR` calling `PUT /policy`) |
| `404 Not Found` | `RESOURCE_NOT_FOUND` | Order, customer, recommendation, or item not found in authenticated merchant workspace (includes cross-tenant IDOR attempts) |
| `422 Unprocessable Entity` | `INTERVENTION_ACTION_NOT_ALLOWED` | Executing an unapproved item, acting on `NO_INTERVENTION`, or acting on an expired/superseded recommendation |
| `422 Unprocessable Entity` | `INVALID_STATUS_TRANSITION` | Illegal `InterventionStatus` transition |
| `422 Unprocessable Entity` | `CONSENT_REQUIRED` | Execution blocked at runtime because customer consent is `UNKNOWN`/`DENIED` or DNC opt-out is active |
| `422 Unprocessable Entity` | `POLICY_RESTRICTION` | Execution blocked by merchant policy, contact cap, post-dispatch lifecycle, or non-sandbox provider guard |
