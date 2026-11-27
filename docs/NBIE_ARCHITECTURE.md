# NORTHSTAR — Next-Best-Intervention Engine (NBIE) Architecture

**Module:** `com.ordexa.intervention` + `src/pages/InterventionsPage.jsx`  
**Schema Migration:** `V6__next_best_intervention_engine.sql`  
**Active Ruleset:** `NBIE_RULESET_V1`  
**Authority Scope:** Pre-dispatch uncertainty-resolution recommendations **only**.

---

## 1. Executive Summary & Strict Authority Boundary

The Next-Best-Intervention Engine (NBIE) is a deterministic, explainable pre-dispatch decision-support module within the NORTHSTAR modular monolith. It inspects server-assembled order, customer history, address completeness, calling verification, communication consent, merchant policy, and the existing Four-Pillar RTO assessment (`RtoRiskScoringService`) to recommend the lightest effective intervention(s) that resolve pre-dispatch uncertainty.

### Non-Negotiable Authority Invariants
1. **Recommendations Only:** NBIE never approves, declines, rejects, cancels, holds, or releases an order.
2. **Zero Order Mutation:** NBIE never mutates `Order.orderStatus`, `Order.paymentStatus`, `OrderStatusHistory`, inventory, shipment, or dispatch state. `OrderRepository` is never used to write order state inside `com.ordexa.intervention`.
3. **Action Approval != Order Approval:** `POST /api/v1/interventions/items/{itemId}/approve` authorizes executing a proposed intervention action only; `POST /api/v1/interventions/items/{itemId}/reject` declines performing that intervention without cancelling or penalizing the order.
4. **Sandbox-Only Execution:** Approved actions execute exclusively through narrow sandbox/internal adapters (`SANDBOX`, `DRY_RUN`, `INTERNAL`). No live PSTN, WhatsApp, SMS, or payment capture is performed.
5. **Separate Future Final Decision Engine:** Final order disposition (`APPROVE` / `HOLD` / `DECLINE`) belongs exclusively to a future, separate Final Decision Engine that is intentionally not implemented or stubbed inside NBIE.

---

## 2. End-to-End Data Flow

```text
Order Created / Updated (com.ordexa.order)
        │
        ▼
Customer History & Behavioural Graph (com.ordexa.customer.intelligence)
        │
        ▼
Existing Four-Pillar RTO Engine (com.ordexa.risk.RtoRiskScoringService)
        │
        ▼
InterventionInputAssembler (server-side, JWT merchantId scoped)
        │
        ▼
InterventionRuleEvaluator (pure deterministic NBIE_RULESET_V1)
        │
        ▼
InterventionFeasibilityService (consent, DNC, channel, contact caps, policy)
        │
        ▼
InterventionRankingService (deduplicate + rank 1 PRIMARY, up to 2 SECONDARY)
        │
        ▼
Persist InterventionRecommendation + Minimized JSONB Evidence Snapshot + Audit
        │
        ▼
Merchant Review -> Approve Action / Reject Action (InterventionApprovalService)
        │
        ▼
InterventionExecutionCoordinator -> Re-verify Consent/Policy -> Sandbox Adapter
        │
        ▼
InterventionOutcomeService -> Record Verified / Inconclusive Outcome + Refresh NBIE
        │
        ▼
[Out of Scope / Future Module] Separate Final Decision Engine
```

---

## 3. Component Responsibilities

| Component | Package / Path | Responsibility | Explicit Non-Responsibilities |
| :--- | :--- | :--- | :--- |
| `InterventionController` | `com.ordexa.intervention.controller` | REST contracts, `@PreAuthorize` role enforcement, Jakarta Bean Validation | Never accepts client-supplied `merchantId`, risk score, consent, or customer history |
| `InterventionInputAssembler` | `com.ordexa.intervention.assembler` | Server-side tenant-scoped assembly of order, customer, address, calling, consent, policy, and 4-pillar RTO inputs | Never fabricates missing values or coerces `0/0` COD delivery rate to `0%` |
| `AddressSignalExtractor` | `com.ordexa.intervention.assembler` | Deterministic structural check (`ADDRESS_COMPLETENESS_V1`) for unit/street, locality, Indian 6-digit PIN, and landmark | Never stores raw street addresses in NBIE snapshots |
| `InterventionRuleEvaluator` | `com.ordexa.intervention.rules` | Pure, stateless candidate generation (`NBIE_RULESET_V1`) | No LLM calls, no uncalibrated confidence scores, no negative cold-start penalties |
| `InterventionFeasibilityService` | `com.ordexa.intervention.service` | Filters candidates against `ConsentStatus`, DNC opt-out, contact caps, cooldowns, duplicates, and merchant policy; re-verifies at execution | Never treats `UNKNOWN` consent as permission to contact |
| `InterventionRankingService` | `com.ordexa.intervention.service` | Merges duplicate types and ranks by conflict-review priority, urgency weight, and least customer friction | Never emits order-level decisions |
| `InterventionEngineService` | `com.ordexa.intervention.service` | Orchestrates evaluation stages, SHA-256 evidence fingerprinting, idempotent persistence, and superseding prior active records | Never mutates `Order` |
| `InterventionApprovalService` | `com.ordexa.intervention.service` | Action-only `ACTION_APPROVED` / `ACTION_REJECTED` transitions and approval history | Does not inject `OrderRepository`; never mutates order status |
| `InterventionExecutionCoordinator` | `com.ordexa.intervention.service` | Enforces prior approval, runtime consent/policy re-check, idempotency key deduplication, and sandbox adapter invocation | Never triggers live communications or marks customer confirmed on dispatch ack |
| `SandboxVoiceInterventionAdapter` | `com.ordexa.intervention.adapter` | Narrow adapter delegating `COD_CONFIRMATION` queueing to `CallingWorkflowService` strictly when provider is `SANDBOX` | Owns zero telephony SDKs or carrier secrets |
| `InternalHumanReviewAdapter` | `com.ordexa.intervention.adapter` | Routes `HUMAN_REVIEW` items to internal merchant operations review | Does not place a dispatch hold on the order |
| `InterventionOutcomeService` | `com.ordexa.intervention.service` | Persists minimized outcome records (`verifiedResponse` vs inconclusive) and optionally triggers fresh NBIE re-evaluation | Never infers fraud from `NO_ANSWER` or `BUSY` |
| `InterventionAuditService` | `com.ordexa.intervention.service` | Writes sanitized append-only `intervention_audit_events` + workspace `audit_logs` with MDC `correlationId` | Never logs phone numbers, street addresses, secrets, tokens, or transcripts |

---

## 4. Persistence Model (`V6__next_best_intervention_engine.sql`)

All NBIE tables include `merchant_id UUID NOT NULL` foreign keys to `merchants(id)` and merchant-prefixed composite indexes:

1. **`intervention_policies`**: Merchant-scoped bounded configuration (`partial_advance_enabled` defaults `FALSE`; `partial_advance_payment_capable` defaults `FALSE`; `enabled_channels` defaults `'VOICE_SANDBOX'`; contact caps and TTLs).
2. **`intervention_customer_consents`**: Merchant + customer consent provenance (`GRANTED`, `DENIED`, `UNKNOWN`). Read alongside `customer_calling_preferences.opted_out` (without duplicating `opted_out`).
3. **`intervention_recommendations`**: Master evaluation record per order evaluation with `status`, `evaluation_status`, `ruleset_version`, `idempotency_fingerprint`, `active_record`, 4-pillar RTO snapshot columns, `evidence_completeness`, PII-minimized `evidence_snapshot JSONB`, `superseded_by_id`, `evaluated_at`, `expires_at`, and optimistic lock `version`.
4. **`intervention_recommendation_items`**: Ranked `PRIMARY` / `SECONDARY` actions constrained at DB level to `('COD_CONFIRMATION', 'ADDRESS_CLARIFICATION', 'HUMAN_REVIEW', 'OPTIONAL_PARTIAL_ADVANCE', 'NO_INTERVENTION')`.
5. **`intervention_approvals`**: Immutable actor, role, `ACTION_APPROVED` / `ACTION_REJECTED` decision, note, and timestamp.
6. **`intervention_execution_logs`**: Idempotent (`UNIQUE (idempotency_key)`) execution records constrained at DB level to `provider_mode IN ('SANDBOX', 'DRY_RUN', 'INTERNAL')`.
7. **`intervention_outcomes`**: Idempotent outcome records distinguishing `verified_response = true` from inconclusive contact attempts.
8. **`intervention_audit_events`**: Append-only structured audit trail with correlation IDs and ruleset versions.

---

## 5. Security, Privacy, and Tenant Isolation

- **Tenant Resolution:** Live Supabase inspection verified `rowsecurity = false` across public tables; therefore, every NBIE controller and service derives `merchantId` strictly from `TenantContextHolder.requireActiveWorkspace()` and scopes every JPA query by `(id, merchantId)`. Cross-tenant object IDs return `404 ResourceNotFoundException` (IDOR-safe).
- **Role Matrix:**
  - `VIEWER`: Read-only access to `/overview`, `/queue`, `/recommendations/{id}`, `/orders/{orderId}/recommendations`, `/policy`, and `/customers/{customerId}/consent`.
  - `OPERATOR`, `MANAGER`: Evaluate orders, approve/reject intervention actions, execute sandbox actions, record outcomes, refresh recommendations, and record verified customer consent.
  - `ADMIN`, `OWNER`: Modify merchant NBIE policy (`PUT /api/v1/interventions/policy`).
- **PII Minimization:** `InterventionAuditService.sanitizeMetadata(...)` strips any key matching phone, street/shipping/billing address, secret, token, password, or transcript. Customer phone numbers in API DTOs are masked via `CallingDndPolicy.maskPhone(...)` (e.g., `+91 98••••3344`).

---

## 6. Event Integration & Failure Handling

- `InterventionEventListener` listens to `OrderCreatedForCallingEvent` at `@Order(200)` (after `CallingWorkflowService`) only when both `northstar.nbie.enabled=true` and `northstar.nbie.auto-evaluate=true` (default `false`).
- Exceptions inside `InterventionEventListener` are caught and logged without rolling back order creation.
- NBIE persistence never publishes `OrderCreatedForCallingEvent`, preventing recursive evaluation loops.
- **Failure Modes:**
  - Missing RTO assessment → `EvaluationStatus.ASSESSMENT_UNAVAILABLE` (no fabricated score/band).
  - Stale RTO assessment (`age > maxRtoAssessmentAgeMinutes`) → `EvaluationStatus.ASSESSMENT_STALE_REFRESH_REQUIRED`.
  - Post-dispatch order (`SHIPPED` / `DELIVERED`) → `EvaluationStatus.NOT_APPLICABLE_POST_DISPATCH` (NDR handled separately).
  - Cancelled order (`CANCELLED`) → `EvaluationStatus.NOT_APPLICABLE_CANCELLED`.
  - Duplicate evaluate call with identical evidence & ruleset → returns existing active recommendation idempotently.
  - Consent revoked between action approval and execution → `InterventionExecutionCoordinator` blocks execution with `422 CONSENT_REQUIRED` and logs `BLOCKED_CONSENT`.

---

## 7. Future Final Decision Engine Handoff Contract

A future, separate **Final Decision Engine** module (`com.ordexa.decision` — not implemented in this phase) should consume a read-only handoff projection containing:

1. **Order & Initial Risk Context:** `orderId`, `orderStatus`, `paymentMethod`, `totalAmount`, initial and latest `RtoRiskAssessmentDto` snapshots (`totalRiskScore`, `riskBand`, 4 pillar scores, `reasonCodes`, `assessedAt`).
2. **NBIE Recommendation Provenance:** `recommendationId`, `rulesetVersion`, `evaluationStatus`, `evidenceCompleteness`, `evidenceSnapshot` (including `conflictingEvidenceIndicators`, `unknownDataWarnings`, and `droppedCandidates`).
3. **Distinct Lifecycle Evidence Stages (Never Conflated):**
   - *Recommended:* `InterventionRecommendationItem` (`type`, `priority`, `reasonCodes`, `requiredEvidence`).
   - *Action Approved / Rejected:* `InterventionApproval` (`ACTION_APPROVED` vs `ACTION_REJECTED` by operator).
   - *Sandbox Dispatched:* `InterventionExecutionLog` (`ACCEPTED_SANDBOX` — **not** proof that customer answered or confirmed).
   - *Customer Response Verified vs Inconclusive:* `InterventionOutcome` (`outcomeType`, `verifiedResponse = true` for `CUSTOMER_CONFIRMED_INTENT` / `ADDRESS_DETAILS_PROVIDED` / `CUSTOMER_DENIED_ORDER` vs `verifiedResponse = false` for `NO_ANSWER_INCONCLUSIVE` / `BUSY_INCONCLUSIVE`).
   - *Delivery Outcome Verified:* Terminal courier telemetry (`DELIVERED` vs future verified `RTO`).

Only that separate engine—with its own merchant policy, authorization rules, and audit table—may recommend or execute final order-level `APPROVE`, `HOLD`, or `DECLINE` transitions.
