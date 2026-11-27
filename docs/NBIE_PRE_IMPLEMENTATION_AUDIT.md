# NORTHSTAR — NBIE Phase 0 Pre-Implementation Audit

**Audit Timestamp:** `2026-11-27`  
**Repository Branch:** `main` (tracking `origin/main`, HEAD commit `697f8c5` — `docs: update NORTHSTAR development roadmap`)  
**Scope:** Complete code, configuration, runtime, and live Supabase PostgreSQL schema audit prior to implementing the Next-Best-Intervention Engine (NBIE).

---

## 1. Repository, Build, and Runtime Reality

### 1.1 Git & Working Tree State
- **Active Branch:** `main` (`origin/main` at `697f8c5`).
- **Working Tree Coexistence:** Active AI Calling Agent files exist in the working tree (`server/src/main/java/com/ordexa/calling/**`, `server/src/main/java/com/ordexa/risk/**`, `server/src/main/resources/db/migration/V5__ai_calling_agent.sql`, `voice-service/**`, `src/pages/CallingIntelligencePage.jsx`, `src/services/api/callingApi.js`).
- **Preservation Rule:** NBIE lives strictly inside `com.ordexa.intervention.*` (expanding the existing placeholder `server/src/main/java/com/ordexa/intervention/package-info.java`) and additive frontend modules (`src/pages/InterventionsPage.jsx`, `src/services/api/interventionsApi.js`). Existing AI Calling Agent and Four-Pillar RTO files are preserved intact without destructive edits, rebases, or overwrites.

### 1.2 Confirmed Framework & Tooling Versions
| Layer | Inspected File | Actual Version / Configuration | Compatibility Note |
| :--- | :--- | :--- | :--- |
| **Java / JDK** | `server/pom.xml` & host `java -version` | `pom.xml` sets `<java.version>17</java.version>` with auto-activated `java21` profile on `[21,)`. Host JVM is **OpenJDK Temurin 17.0.20.1**. | **Prompt vs Reality Conflict Resolved:** Prompt references Java 21; host compiler is JDK 17.0.20.1. All NBIE code uses Java 17/21-compatible records, enums, and switch expressions so builds pass under both JDK 17 and JDK 21. |
| **Spring Boot** | `server/pom.xml` | **3.4.3** (`spring-boot-starter-web`, `data-jpa`, `security`, `validation`, `actuator`) | Uses Hibernate 6.6 with `spring.jpa.hibernate.ddl-auto=validate` and `open-in-view=false`. |
| **Database & Migrations** | `application.yml`, `application-supabase.yml`, `application-test.yml` | **Supabase PostgreSQL** (`aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require`) + **Flyway** (`flyway-core`, `flyway-database-postgresql`). Automated tests use **H2** (`MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE`). | All additive Flyway DDL (`V6`) must validate cleanly on **both** Supabase PostgreSQL and H2 `MODE=PostgreSQL` with Hibernate `ddl-auto=validate`. |
| **Frontend** | `package.json` | **React `^18.3.1`**, **Vite `^6.0.5`**, **Tailwind CSS `^3.4.17`**, **Zustand `^5.0.2`**, **React Router DOM `^6.28.0`**, **Lucide React `^0.468.0`** | Matches modular SPA conventions (`apiClient.js` with in-memory JWT + single-flight refresh). |
| **Calling & Voice Runtime** | `application.yml`, `voice-service/src/server.js` | `ordexa.calling.provider=SANDBOX`, `CALLING_DISPATCH_MODE=DRY_RUN` (`liveCallsEnabled=false`) | Strictly non-live; NBIE adapters enforce `SANDBOX` / `DRY_RUN` / `INTERNAL` execution modes only. |

---

## 2. Connected Database & Flyway Migration Audit

### 2.1 Applied Flyway Migrations (Live `flyway_schema_history`)
Queried directly against the connected Supabase PostgreSQL instance:

| Rank | Version | Script | Installed On (UTC) | Success |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `1` | `V1__init_foundation_metadata.sql` | `2026-11-25 15:08:20` | `true` |
| 2 | `2` | `V2__init_merchants_users_and_memberships.sql` | `2026-11-25 15:08:26` | `true` |
| 3 | `3` | `V3__init_customers_orders_and_history.sql` | `2026-11-25 15:08:36` | `true` |
| 4 | `4` | `V4__customer_intelligence.sql` | `2026-11-25 15:08:44` | `true` |
| 5 | `5` | `V5__ai_calling_agent.sql` | `2026-11-25 17:15:32` | `true` |

- **Next Valid Additive Migration Version:** **`V6__next_best_intervention_engine.sql`**.

### 2.2 Row-Level Security (RLS) Verification
- Live query against `pg_tables` (`WHERE schemaname = 'public'`) confirmed **`rowsecurity = false` across all 19 public tables**, and `pg_policies` returned **`0` policies**.
- **Security Reality:** Schema tables are multi-tenant keyed (`merchant_id NOT NULL` + composite indexes/FKs), i.e., *RLS-ready* structurally, **not** RLS-enforced in PostgreSQL. Tenant isolation is enforced in the Spring Boot application tier via `JwtAuthenticationFilter` → `TenantContextHolder` → `TenantAuthorizationService` (`@PreAuthorize("@tenantAuth.hasMinimumRole(...)")`) and explicit `merchant_id` scoping on every repository query and mutation. NBIE must enforce server-derived `merchantId` and object-level ownership on 100% of reads and writes.

---

## 3. Existing Domain Modules & Reusable Services

### 3.1 Security, Tenant Context & Audit
- `com.ordexa.tenant.context.TenantContextHolder`: Resolves authenticated `TenantContext` (`userId`, `email`, `fullName`, `sessionId`, `merchantId`, `role`) strictly from verified JWT claims (`JwtAuthenticationFilter`). Never trusts request body/query `merchantId`.
- `com.ordexa.tenant.security.TenantAuthorizationService` (`@Component("tenantAuth")`): Role hierarchy `OWNER(5) > ADMIN(4) > MANAGER(3) > OPERATOR(2) > VIEWER(1)`.
- `com.ordexa.auth.entity.AuditLog` & `AuditLogRepository`: Tenant-scoped immutable security audit records.
- `com.ordexa.common.util.CorrelationIdFilter`: Populates MDC `correlationId` from `X-Correlation-Id` header.

### 3.2 Orders, Lifecycle & Customer History
- `com.ordexa.order.entity.Order` (`orders` table):
  - Fields: `id`, `merchantId`, `orderNumber`, `customer` (`customer_id`), `source` (`MANUAL`, `SHOPIFY`, `WOOCOMMERCE`, `CSV`), `orderStatus`, `paymentStatus`, `paymentMethod`, `subtotal`, `discount`, `shippingFee`, `totalAmount`, `currency`, `shippingAddress` (`VARCHAR(1024)`), `billingAddress`, `customerNotes`, `createdAt`, `updatedAt`, `version`.
  - `OrderStatus` state machine (`OrderStatus.java`):
    - Pre-dispatch states: `CREATED`, `CONFIRMED`, `PROCESSING`
    - Post-dispatch states: `SHIPPED`, `DELIVERED`
    - Cancelled terminal state: `CANCELLED`
- `com.ordexa.customer.entity.Customer` (`customers` table):
  - Merchant-scoped (`UNIQUE (merchant_id, phone_number)` — no cross-merchant customer sharing).
  - Fields: `id`, `merchantId`, `fullName`, `phoneNumber`, `email`, `totalOrders`, `totalSpent`, `firstOrderAt`, `lastOrderAt`, `createdAt`, `updatedAt`.
- `com.ordexa.customer.intelligence.analytics.CustomerIntelligenceCalculator`:
  - Explicitly establishes (`DATA_QUALITY_NOTE`): *"Return-to-Origin (RTO) requires verified courier delivery-outcome telemetry and is never inferred from cancellations."*

### 3.3 Existing Four-Pillar RTO Engine (Directly Reusable)
- `com.ordexa.risk.RtoRiskScoringService` & `com.ordexa.risk.RtoRiskAssessmentDto`:
  - Computes deterministic 0–100 score, `riskBand` (`LOW` `<25`, `MEDIUM` `25..54`, `HIGH` `>=55`), four pillar point breakdowns (`behaviouralRiskPoints`, `orderRiskPoints`, `callingOutcomePoints`, `historicalConfirmationPoints`), and explainable `reasonCodes`:
    - Pillar 1 (`BEHAVIOURAL`): `REPEATED_COD_REFUSAL`, `PRIOR_DELIVERY_EXCEPTION`, `NEW_CUSTOMER`, `VERIFIED_RETURNING_BUYER`
    - Pillar 2 (`ORDER`): `ADDRESS_INCOMPLETE`, `CONFIRMATION_PENDING`, `HIGH_VALUE_ORDER`, `PREPAID_ORDER_DISCOUNT`
    - Pillar 3 (`CALLING_OUTCOME`): `CALL_CONFIRMED_INTENT`, `CALL_DENIED_ORDER`, `CALL_CANCELLATION_INTENT`, `CALL_INVALID_PHONE_NUMBER`, `CALL_REQUIRES_HUMAN_FOLLOWUP`, `REPEATED_UNANSWERED_CALLS`, `CALL_UNANSWERED_NEUTRAL`, `CALL_PROVIDER_FAILED_NEUTRAL`
    - Pillar 4 (`HISTORICAL_CONFIRMATION`): `HISTORICAL_CALL_RELIABLE`, `HISTORICAL_CONFIRMATION_FAILURE`
  - **Important Note:** `RtoRiskAssessmentDto.recommendedAction` is a legacy human-readable hint string containing dispatch/hold phrasing. **NBIE ignores `RtoRiskAssessmentDto.recommendedAction`** and consumes only `totalRiskScore`, `riskBand`, pillar scores, and `reasonCodes`.

### 3.4 Existing AI Calling Agent & Narrow Boundary
- Entities: `CallingConfiguration`, `CustomerCallingPreference`, `CallSession`, `CallAttempt`, `CallEvent`.
- Compliance helper: `CallingDndPolicy` (`isInDndWindow`, `normalizeToE164`, `maskPhone` — masks Indian numbers to `+91 98••••1101`).
- Event: `OrderCreatedForCallingEvent(UUID merchantId, UUID orderId)` published synchronously by `OrderService.createOrderForTenant`.
- **NBIE Execution Adapter Boundary:** NBIE must not depend on telephony SDKs or credentials, and must avoid circular dependencies with `CallingWorkflowService`. A narrow `InterventionExecutionAdapter` interface will invoke `CallingWorkflowService.enrollCodOrderIfEligible(order, false)` (queueing in `SANDBOX` mode without bypassing DND or consent) or record sandbox-only structured outreach logs after explicit action approval and re-verified consent/policy checks.

### 3.5 Frontend Architecture
- Routes (`src/App.jsx`): Protected workspace routes under `/app/*` inside `AppShell.jsx` (wrapped with `ErrorBoundary.jsx` and structured `ToastContainer` in `Primitives.jsx`).
- Note on `/app/rescue` (`RescueCentrePage.jsx`): Legacy client-side mock demo screen backed by `useOrdexaStore` mock arrays. Per prompt constraint (*"Do not rebuild unrelated screens"*), `/app/rescue` is left untouched, and NBIE is mounted at `/app/interventions` (`InterventionsPage.jsx`) wired 100% to real `/api/v1/interventions/**` backend endpoints.

---

## 4. Identified Schema/Data Gaps & Design Resolutions

1. **No Separate `shipments` Table or `dispatch_status` Column:**
   - *Reality:* `orders` tracks fulfillment via `order_status` (`CREATED`, `CONFIRMED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`).
   - *Resolution:* Derive `dispatchLifecycleState` directly from `OrderStatus`: `PRE_DISPATCH` (`CREATED`, `CONFIRMED`, `PROCESSING`), `POST_DISPATCH` (`SHIPPED`, `DELIVERED`), `CANCELLED` (`CANCELLED`). Post-dispatch orders immediately return `EvaluationStatus.NOT_APPLICABLE_POST_DISPATCH` without generating pre-dispatch interventions.
2. **Unstructured `shipping_address` (`VARCHAR(1024)`):**
   - *Reality:* No separate `addresses` table or `pincode`/`landmark` columns exist on `orders`.
   - *Resolution:* Deterministic parser `AddressSignalExtractor` (`ADDRESS_SPEC_V1`) inspects `shippingAddress` (and `customerNotes` for delivery instructions) without duplicating columns:
     - **PIN Validity:** Regex `\b[1-9]\d{5}\b` → `VALID`; malformed 6-digit starting with `0` (`\b0\d{5}\b`) → `INVALID`; no 6-digit token → `UNKNOWN`.
     - **Landmark Presence:** Explicit landmark markers (`near`, `opp`, `opposite`, `behind`, `beside`, `adjacent`, `landmark`, `pillar`, `gate`, `metro`, `chowk`, `temple`, `hospital`, `school`, `mall`, `park`) → `PRESENT` vs `MISSING`.
     - **Unit/Street Specificity:** Building/unit/street markers + minimum length (`>= 18` chars and `>= 3` comma/space-delimited segments).
3. **No Verified Courier `RTO` Status in `orders`:**
   - *Reality:* `chk_orders_status` only permits `CREATED`, `CONFIRMED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`, and `SHIPPED` can only transition to `DELIVERED`. Pre-dispatch `CANCELLED` is **not** RTO.
   - *Resolution:* `verifiedSuccessfulDeliveryCount` counts prior `DELIVERED` orders. `verifiedRtoCount` is derived from recorded verified RTO outcomes if any exist, otherwise remains `null` (`UNKNOWN`) — never fabricated from `CANCELLED`. `priorCodSuccessRate` divides verified COD deliveries by `(verifiedCodDeliveries + verifiedCodRtos)` when verified completed COD outcomes exist; if denominator is `0`, returns `null` (`UNKNOWN`), never `0%`.
4. **No Affirmative Per-Customer Consent Table in V1–V5:**
   - *Reality:* `customer_calling_preferences` only stores negative opt-out (`opted_out = true`).
   - *Resolution:* Add `intervention_customer_consents` in `V6` (`GRANTED`, `DENIED`, `UNKNOWN`). If `customer_calling_preferences.opted_out = true` or `call_sessions.do_not_call_further = true` (opt-out/cancellation), effective consent is `DENIED` (`dncOptedOut = true`). If no consent row exists, effective consent is **`UNKNOWN`**, which suppresses outbound contact recommendations per the hard rule *"Unknown consent is not permission to contact"*. Operators/integrations can record verified customer consent via a tenant-scoped endpoint (`PUT /api/v1/interventions/customers/{customerId}/consent`).
5. **No Persisted RTO Assessment Table:**
   - *Reality:* `RtoRiskScoringService` computes assessments dynamically from live tables.
   - *Resolution:* `InterventionInputAssembler` invokes `RtoRiskScoringService.assessOrder(...)` with server timestamp `assessedAt` and persists the resulting snapshot (`rto_score`, `rto_band`, `rto_reason_codes`, `rto_assessed_at`) on `intervention_recommendations`. Missing or stale assessments (`age > maxRtoAssessmentAgeMinutes`) return `ASSESSMENT_UNAVAILABLE` or `ASSESSMENT_STALE_REFRESH_REQUIRED` without fabricating a risk band.
6. **No NBIE Merchant Policy Table:**
   - *Resolution:* Add `intervention_policies` in `V6` with safe defaults (`partial_advance_enabled = false`, `partial_advance_payment_capable = false`, `enabled_channels = 'VOICE_SANDBOX'`, `require_approval_for_contact = true`, contact caps).

---

## 5. NBIE Input-to-Source Mapping Table

| NBIE Input | Actual Source | Direct / Derived | Transformation | Freshness | Null / Missing Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `merchantId` | `TenantContextHolder.requireActiveWorkspace().merchantId()` (or verified event `merchantId`) | Direct | Authenticated JWT claim + active `merchant_memberships` check; client input ignored. | Real-time per request | `401 Unauthorized` / `403 Forbidden` if missing or mismatched. |
| `orderId`, `orderNumber` | `orders.id`, `orders.order_number` (`OrderRepository.findByIdAndMerchantIdWithCustomer`) | Direct | Verified against `merchantId` (IDOR-safe). | Live DB read | `404 ResourceNotFoundException` if absent in workspace. |
| `customerId` | `orders.customer_id` (`customers.id`) | Direct | Loaded via `Order.getCustomer()` within same `merchantId`. | Live DB read | Required FK (`NOT NULL` in `orders`). |
| `orderValue`, `currency` | `orders.total_amount`, `orders.currency` | Direct | `BigDecimal(14,2)` scaled `HALF_UP`. | Live DB read | Required `NOT NULL` column. |
| `paymentMethod`, `paymentStatus` | `orders.payment_method`, `orders.payment_status` | Direct | `PaymentMethod` (`COD`, `PREPAID`, `UPI`, `CARD`, `NETBANKING`) & `PaymentStatus`. | Live DB read | Required `NOT NULL` columns. |
| `orderStatus` | `orders.order_status` | Direct | `OrderStatus` (`CREATED`, `CONFIRMED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`). | Live DB read | Required `NOT NULL` column. |
| `dispatchStatus` | `orders.order_status` | Derived | `CREATED/CONFIRMED/PROCESSING` → `PRE_DISPATCH`; `SHIPPED/DELIVERED` → `POST_DISPATCH`; `CANCELLED` → `CANCELLED`. | Live DB read | Never null; `POST_DISPATCH` short-circuits with `NOT_APPLICABLE_POST_DISPATCH`. |
| `orderCreatedAt`, `orderUpdatedAt` | `orders.created_at`, `orders.updated_at` | Direct | `OffsetDateTime` (UTC). | Live DB read | Required `NOT NULL` columns. |
| `priorOrderCount` | `OrderRepository.findByMerchantIdAndCustomerIdOrderByCreatedAtDesc` | Derived | Count of customer's orders in `merchantId` excluding current `orderId`. | Live DB read | `0` for first-time buyer (`coldStart = true`, treated neutrally). |
| `verifiedSuccessfulDeliveryCount` | Prior `orders` where `order_status = 'DELIVERED'` | Derived | Count of prior `DELIVERED` orders excluding current `orderId`. | Live DB read | `0` when none exist (neutral for cold-start). |
| `verifiedRtoCount` | Schema gap (`orders` has no `RTO` status) | Derived | `null` (`UNKNOWN`) in V1 schema; never inferred from `CANCELLED`. `priorCancelledCount` tracked separately as pre-dispatch cancellations. | N/A (telemetry unavailable) | Remains `null` (`UNKNOWN`); surfaces provenance note `VERIFIED_RTO_TELEMETRY_UNAVAILABLE`. |
| `priorCodSuccessRate` | Prior `orders` (`payment_method = 'COD'`) | Derived | `verifiedCodDeliveries / eligibleCompletedCodOrders` (excludes pending & pre-dispatch `CANCELLED`). | Live DB read | Returns `null` (`UNKNOWN`) when denominator is `0` or verified RTO count is unknown with `0` deliveries — never coerced to `0%`. |
| `addressCompleteness`, `missingAddressFields` | `orders.shipping_address`, `orders.customer_notes` | Derived | `AddressSignalExtractor` (`ADDRESS_SPEC_V1`) checks `streetOrUnit`, `localityOrCity`, `pinCode`, `landmark`; minimizes PII to boolean flags + missing field names only. | Live DB read (`orders.updated_at`) | Blank/null address → `INCOMPLETE` with all required fields listed; never stores raw street text in NBIE snapshots. |
| `pinValidityState` | `orders.shipping_address` | Derived | `\b[1-9]\d{5}\b` → `VALID`; `\b0\d{5}\b` → `INVALID`; absent → `UNKNOWN`. | Live DB read | Remains `UNKNOWN` if no 6-digit PIN found in free-text address. |
| `landmarkPresence` | `orders.shipping_address`, `orders.customer_notes` | Derived | Keyword check for landmark indicators (`near`, `opposite`, `behind`, `landmark`, `pillar`, `gate`, `metro`, etc.). | Live DB read | `MISSING` when no landmark indicator detected. |
| `codConfirmationStatus` | `orders.order_status`, `call_sessions.final_outcome`, `intervention_outcomes` | Derived | `CONFIRMED` if `CallOutcome.CONFIRMED`, `CUSTOMER_CONFIRMED_INTENT`, or `OrderStatus.CONFIRMED`; `DENIED` if `CallOutcome.REJECTED` or `CUSTOMER_DENIED_ORDER`; `CANCELLATION_REQUESTED` if requested; `NOT_APPLICABLE` if non-COD; else `PENDING`. | Validated against `call_sessions.updated_at` (stale if older than order address/amount edit) | Defaults to `PENDING` for unconfirmed COD, `NOT_APPLICABLE` for prepaid. |
| `lastCallingOutcome`, `callingAttemptCount` | `call_sessions.final_outcome`, `call_sessions.attempt_count`, `call_sessions.last_attempt_at` | Direct | Loaded via `CallSessionRepository.findByMerchantIdAndOrder_Id`. | Checked against `staleCallHours` (default 24h) | `null` outcome and `0` attempts if no `CallSession` exists (`NO_ANSWER`/`BUSY`/`CALL_FAILED` treated as inconclusive, never fraud). |
| `consentStatus`, `dncOptedOut` | `customer_calling_preferences.opted_out`, `call_sessions.do_not_call_further`, `intervention_customer_consents.consent_status` | Derived | `opted_out == true` → `DENIED` + `dncOptedOut = true`; else `intervention_customer_consents.consent_status`. | Live DB read & re-verified at execution | Missing consent row → `UNKNOWN` (**blocks** contact actions; unknown consent is never permission). |
| `preferredLanguage` | `customer_calling_preferences.preferred_language`, fallback `calling_configurations.default_language` | Direct | Normalized BCP-47 tag (e.g., `hi-IN`, `en-IN`). | Live DB read | Null if unset; falls back to merchant default only when contact is permitted. |
| `lastContactAt`, `recentContactCount24h` | `call_attempts.started_at` + `intervention_execution_logs.executed_at` | Derived | Latest outbound timestamp and 24h count across voice attempts and NBIE executions for customer/order. | Live DB read | `null` / `0` if never contacted. |
| `rtoScore`, `rtoBand`, `rtoPillarScores`, `rtoReasonCodes`, `rtoAssessedAt` | `RtoRiskScoringService.assessOrder` | Direct / Computed | Invokes existing 4-pillar scorer; ignores `recommendedAction` text. | Freshness validated (`age <= maxRtoAssessmentAgeMinutes`, default 60m) | Null/exception → `EvaluationStatus.ASSESSMENT_UNAVAILABLE`; stale → `ASSESSMENT_STALE_REFRESH_REQUIRED`. Never fabricates a risk band. |
| `merchantPolicy` | `intervention_policies` + `calling_configurations` | Direct | Loads merchant NBIE policy + DND window (`dnd_start_hour_ist`, `dnd_end_hour_ist`, `dnd_resume_minute_ist`). | Live DB read | Uses safe non-permissive defaults (`partialAdvanceEnabled = false`, `enabledChannels = VOICE_SANDBOX`, `requireApprovalForContact = true`). |
