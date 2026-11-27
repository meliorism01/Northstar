# NORTHSTAR — NBIE Operations, Safety & Runbook

## 1. Configuration Reference (`application.yml`)

All NBIE settings under `northstar.nbie.*` are non-secret and environment-overridable:

| Property | Env Variable | Default | Purpose |
| :--- | :--- | :--- | :--- |
| `northstar.nbie.enabled` | `NBIE_ENABLED` | `true` | Master NBIE feature toggle across evaluation and execution |
| `northstar.nbie.ruleset-version` | `NBIE_RULESET_VERSION` | `NBIE_RULESET_V1` | Active deterministic ruleset identifier stamped on recommendations and audits |
| `northstar.nbie.auto-evaluate` | `NBIE_AUTO_EVALUATE` | `false` | When `false` (default), orders are evaluated on-demand via API/UI; when `true`, `InterventionEventListener` evaluates after `OrderCreatedForCallingEvent` |
| `northstar.nbie.default-recommendation-ttl-hours` | `NBIE_RECOMMENDATION_TTL_HOURS` | `24` | Default hours before an unacted recommendation expires (`EXPIRED`) |
| `northstar.nbie.max-rto-assessment-age-minutes` | `NBIE_MAX_RTO_AGE_MINUTES` | `60` | Maximum allowed age of an RTO assessment before `ASSESSMENT_STALE_REFRESH_REQUIRED` |
| `northstar.nbie.stale-call-signal-hours` | `NBIE_STALE_CALL_HOURS` | `24` | Age threshold marking inconclusive prior call attempts as stale |
| `northstar.nbie.sandbox-only` | *(hard-coded `true`)* | `true` | Enforces sandbox-only execution guard inside `SandboxVoiceInterventionAdapter` |

---

## 2. Database Migration & Supabase Setup

- **Migration File:** `server/src/main/resources/db/migration/V6__next_best_intervention_engine.sql`
- **Additive Guarantee:** `V6` creates 8 new `intervention_*` tables and indexes only. It does not drop, truncate, alter, or rewrite any existing `V1`–`V5` table or column.
- **Hibernate Validation:** `spring.jpa.hibernate.ddl-auto=validate` remains strictly enforced across `application.yml`, `application-supabase.yml`, and `application-test.yml`.
- **Running Against Hosted Supabase:**
  Supply your environment credentials (never commit secrets to `.env` or git) and run with the `supabase` profile:
  ```powershell
  Set-Location server
  $env:SPRING_PROFILES_ACTIVE = 'supabase'
  $env:SUPABASE_DB_USERNAME = '<your-supabase-pooler-user>'
  $env:SUPABASE_DB_PASSWORD = '<your-supabase-db-password>'
  .\mvnw.cmd spring-boot:run
  ```
  Flyway automatically validates `V1`–`V5` checksums and applies `V6__next_best_intervention_engine.sql` idempotently.

---

## 3. Sandbox & Communication Safety Verification

1. **Calling Provider:** Keep `CALLING_PROVIDER=SANDBOX` (`ordexa.calling.provider=SANDBOX`). `SandboxVoiceInterventionAdapter` checks both global `CallingProperties` and merchant `CallingConfiguration` and throws `422 POLICY_RESTRICTION` if either deviates from `SANDBOX`.
2. **Voice Service Daemon:** Keep `CALLING_DISPATCH_MODE=DRY_RUN` (`liveCallsEnabled: false` on `GET http://localhost:3104/health`).
3. **Database Constraint Enforcement:** `intervention_execution_logs.chk_int_exec_provider_mode` enforces `provider_mode IN ('SANDBOX', 'DRY_RUN', 'INTERNAL')` at the PostgreSQL constraint layer.
4. **No Payment Capture:** `OPTIONAL_PARTIAL_ADVANCE` is disabled by default (`partial_advance_enabled = false`, `partial_advance_payment_capable = false`) and never invokes any payment gateway or alters `orders.payment_status`.

---

## 4. Retention, Expiry & Idempotency

- **Idempotency:**
  - `evaluate`: Computes SHA-256 over `(merchantId, orderId, rulesetVersion, canonicalEvidence)`. Repeated evaluations with unchanged state return the active recommendation without creating duplicate rows. Material evidence changes mark the old active record `SUPERSEDED` (`active_record = false`, `superseded_by_id = <newId>`).
  - `execute`: Deduplicated via `UNIQUE (idempotency_key)` on `intervention_execution_logs`.
  - `outcomes`: Deduplicated via `UNIQUE (idempotency_key)` on `intervention_outcomes`.
- **Expiry:** Recommendations carry `expires_at` (`evaluated_at + recommendation_ttl_hours`, default 24h). Expired recommendations cannot be approved or executed; operators click **Refresh evaluation** (`POST /api/v1/interventions/recommendations/{id}/refresh`) to evaluate current state.

---

## 5. Troubleshooting & Safe Rollback

| Symptom | Cause | Resolution |
| :--- | :--- | :--- |
| Contact candidate (`COD_CONFIRMATION` / `ADDRESS_CLARIFICATION`) suppressed and `HUMAN_REVIEW` (`NBIE-REVIEW-003`) shown | Customer has no affirmative consent record (`ConsentStatus.UNKNOWN`) or has DNC opt-out active | Verify customer consent provenance in the Detail Drawer (`PUT /api/v1/interventions/customers/{customerId}/consent` -> `GRANTED`), then click **Refresh evaluation**. |
| `422 INTERVENTION_ACTION_NOT_ALLOWED` on Execute | Action has not been approved (`ACTION_APPROVAL_PENDING`) or recommendation expired | Click **Approve action** first (or **Refresh evaluation** if expired). |
| `NOT_APPLICABLE_POST_DISPATCH` returned | Order is already `SHIPPED` or `DELIVERED` | Expected: pre-dispatch NBIE does not run on shipped orders; use NDR workflows for post-dispatch delivery exceptions. |

### Safe Feature Disable / Rollback (Zero Data Loss)
To disable NBIE immediately without destructive SQL or schema rollback:
1. Set `NBIE_ENABLED=false` (`northstar.nbie.enabled=false`) and `NBIE_AUTO_EVALUATE=false` — halts evaluations and executions immediately while preserving all historical audit/recommendation records and leaving `orders` and `calling` workflows unaffected.
2. Per-merchant disable: `PUT /api/v1/interventions/policy` with `"enabled": false`.
