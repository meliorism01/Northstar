# NORTHSTAR — Platform Audit & Development Roadmap

**Product:** NORTHSTAR Commerce Intelligence & Decision Platform  
**Tagline:** *Navigate Commerce with Clarity.*  
**Audit Date:** November 25, 2026  
**Repository:** `meliorism01/Ordexa` (`main` branch)  
**Architecture:** Multi-Tenant Modular Monolith (Spring Boot 3.4.x / Java 21) + Cloud PostgreSQL (Supabase) + React 18 SPA (Vite / Tailwind CSS) + Stateless Voice Service (Node.js 20+ / LiveKit / Sarvam AI)

---

## 1. Executive Summary

NORTHSTAR is an enterprise commerce intelligence and automated decision platform designed for high-volume direct-to-consumer (D2C) e-commerce merchants across India. The platform integrates:
- Secure multi-tenant workspace isolation with role-based access control (RBAC).
- High-precision order management and CSV bulk import with row-level error reporting.
- Cloud-hosted PostgreSQL infrastructure on Supabase with zero-downtime Flyway migrations (`V1`–`V5`).
- Behavioral Customer Intelligence Graph with Customer 360 profiling and co-purchase analytics.
- Outbound AI Calling Agent for Cash-on-Delivery (COD) purchase verification, DND compliance, and RTO risk mitigation.

All completed modules have been verified via automated test suites (54 backend tests, 0 failures), end-to-end frontend production builds (Vite 6.4.6, 2,391 modules transformed, 0 errors), and active Supabase Cloud database connectivity.

---

## 2. Platform Audit: Completed Modules

### Milestone 1 — Multi-Tenant Architecture & Enterprise Security
- **Status:** **Completed & Verified**
- **Database Migrations:** `V1__init_foundation_metadata.sql`, `V2__init_merchants_users_and_memberships.sql`
- **Key Capabilities:**
  - In-memory short-lived JWT access tokens (15-minute expiry) and HttpOnly refresh cookies (7-day expiry).
  - Cryptographic refresh token hashing (SHA-256) with token family rotation and replay attack revocation.
  - Multi-tenant workspace partitioning: `TenantContext` ThreadLocal scope enforces merchant boundary isolation on all database queries.
  - Role-Based Access Control (RBAC): `OWNER`, `ADMIN`, `MANAGER`, `OPERATOR`, `VIEWER` with granular permission checks.
  - BCrypt password hashing, rate limiting, and immutable operational audit logging (`audit_logs` table).

### Milestone 2 — Core Commerce & Order Lifecycle Engine
- **Status:** **Completed & Verified**
- **Database Migration:** `V3__init_customers_orders_and_history.sql`
- **Key Capabilities:**
  - Merchant-scoped Customer entity with Indian/E.164 phone normalization and unique constraints (`uq_customers_merchant_phone`).
  - Strict Order Lifecycle State Machine: `CREATED` $\rightarrow$ `CONFIRMED` $\rightarrow$ `PROCESSING` $\rightarrow$ `SHIPPED` $\rightarrow$ `DELIVERED`, with branching to `CANCELLED`.
  - Financial Arithmetic: Monetary fields (`subtotal`, `discount`, `shipping_fee`, `total_amount`, `unit_price`) use exact `BigDecimal(14,2)` arithmetic to eliminate floating-point rounding errors.
  - Optimistic Concurrency Control: `@Version` column prevents race conditions during concurrent status transitions.
  - Safe Deletion Policy: Only orders in `CREATED` or `CANCELLED` statuses may be deleted, restricted to `MANAGER`, `ADMIN`, and `OWNER` roles.
  - CSV Bulk Order Import Engine: Supports multi-line line-item aggregation, validation of headers, phone numbers, quantities, prices, and duplicate detection, returning a detailed `CsvImportSummaryDto`.

### Milestone 3 — Supabase Cloud Database Migration & Analytics
- **Status:** **Completed & Verified**
- **Configuration Profiles:** `application-supabase.yml` (default cloud), `application-local.yml` (offline fallback)
- **Key Capabilities:**
  - Successfully migrated from local PostgreSQL to Supabase Cloud PostgreSQL (Shared Pooler, Session Mode, Port 5432, SSL Required).
  - Fail-Fast Credential Validator: Custom Spring Boot validator halts startup if placeholder or missing database credentials are detected.
  - Analytics & KPI Engine: Computes gross merchandise value (GMV), average order value (AOV), fulfillment velocity, and cancellation rates.
  - Rebranded user-facing interface from ORDEXA to **NORTHSTAR** with tagline *"Navigate Commerce with Clarity"*.

### Milestone 4 — Customer Intelligence Graph & Behavioral Segments
- **Status:** **Completed & Verified**
- **Database Migration:** `V4__customer_intelligence.sql`
- **Key Capabilities:**
  - Customer 360 profiling: Aggregates lifetime value (CLV), purchase frequency, average order value, return-to-origin (RTO) rate, and payment method affinities.
  - 6 Behavioral Segments: Rule-based classification into `CHAMPION`, `LOYAL`, `POTENTIAL_LOYALIST`, `AT_RISK`, `HIBERNATING`, and `LOST` with human-readable reasoning.
  - Product Co-Purchases Matrix: Computes item affinity, pair frequency, and cross-sell probabilities across historical order baskets.
  - Interactive Constellation Visualizer: Multi-tab Cockpit (`/app/graph`) with Customer Directory, Segment Distribution, and interactive co-purchase graph.
  - Refined spotlight KPI cards with optimized typography and high-contrast styling.

### Milestone 5 — AI Calling Agent (Outbound COD Verification)
- **Status:** **Implementation Complete — Production Activation Pending**
- **Database Migration:** `V5__ai_calling_agent.sql` (Creates `merchant_calling_configurations`, `call_sessions`, `call_attempts`, `call_turns`, `call_transcript_chunks`)
- **Key Capabilities:**
  - **Core Business Invariant:** Every eligible Cash-on-Delivery (COD) order enters the calling workflow regardless of its RTO risk score (`LOW`, `MEDIUM`, `HIGH`). The calling agent verifies purchase intent; call signals feed the RTO risk model without suppressing initial verification calls.
  - **Spring Boot Calling Subsystem (`com.ordexa.calling`):**
    - `CallingWorkflowService`: Handles order enrollment, dispatch coordination, outcome recording, and order state transition (`CREATED` $\rightarrow$ `CONFIRMED` upon customer verification).
    - `CallingDndPolicy`: Enforces TRAI regulations (telecom calls permitted only `09:05–21:00 IST`). Dispatches outside this window are automatically rolled forward to `09:05 IST` next business morning. Normalizes 10-digit Indian numbers to E.164 (`+91`).
    - `CallingQueueScheduler`: Background cron poller claiming queued and retry-scheduled calls atomically using PostgreSQL `SKIP LOCKED`.
    - `VoiceCallingProvider`: Pluggable abstraction supporting `SandboxVoiceCallingProvider` (local development/testing) and `HttpVoiceServiceCallingProvider` (live Node.js LiveKit/Sarvam bridge).
    - `CallingWebhookController`: Receives HMAC-SHA256 authenticated webhook callbacks for call lifecycle updates, turn transcripts, and final structured outcomes.
  - **Stateless Voice Service (`voice-service/`):**
    - High-performance Node.js service bridging LiveKit WebRTC/SIP, Sarvam AI (`saaras:v3` STT, `bulbul:v3` TTS), and OpenAI (`gpt-4o-mini` conversational intelligence).
    - Indian-language code-switching (Hindi, English, Hinglish).
    - Automated voicemail and IVR detection in the opening turns to terminate answering machine loops and conserve telecom minutes.
    - Isolated Git attribution (MIT License maintained in `voice-service/LICENSE.third-party.txt` without adding external repository accounts).
  - **4-Pillar RTO Risk Engine Integration (`RtoRiskScoringService`):**
    - Ingests customer call verification signals (confirmed, rejected, address correction, hesitation metrics) to compute updated RTO risk assessments (`RTO_CONFIRMED`, `RTO_SUSPECTED`, `RTO_REJECTED`).
  - **Calling Intelligence Dashboard (`/app/calling`):**
    - Live KPI counters (Total Calls, Verified Rate, Rejected Rate, Pending Queue, Minutes Consumed).
    - Interactive Call Queue Drawer with manual dispatch trigger, live status pills, and cancellation controls.
    - Full Transcript Drawer displaying dual-speaker dialogue, timestamps, latency metrics, and audio playback placeholders.
    - Merchant Calling Configuration panel (auto-confirm toggle, language preference, max retry attempts, retry backoff intervals).

---

## 3. Partially Implemented Features & Technical Debt

| Item | Area | Current Status | Technical Debt / Remaining Work |
| :--- | :--- | :--- | :--- |
| **LiveKit Audio Egress Recording Storage** | Voice Infrastructure | Schema supports `recording_url` in `call_sessions` table; mock/signed URLs rendered in frontend | S3/Cloudflare R2/GCS bucket credentials and LiveKit Egress service configuration must be provisioned for persistent MP3/WAV playback. |
| **DLT Entity & Sender ID KYC** | Telephony / Regulatory | Carrier SIP trunk configuration files prepared for Vobiz / Exotel | TRAI Distributed Ledger Technology (DLT) corporate KYC registration and approved 140-series telemarketing CLI routing must be finalized with Indian telecom carriers. |
| **Supervisor Live Call Eavesdropping** | Frontend / WebRTC | UI action buttons stubbed in Calling Intelligence drawer | LiveKit WebRTC subscriber token generation for real-time manager audio eavesdropping in browser during active calls. |
| **Automated Webhook Dead-Letter Queue (DLQ)** | Backend Messaging | `CallingWebhookController` processes callbacks synchronously; logs failed events | Webhook intake needs durable queuing (PostgreSQL table or Redis) with exponential backoff retries for third-party network glitches. |
| **Shopify / WooCommerce Direct Sync** | Integrations | Scaffolding in `com.ordexa.integration`; REST API and CSV import fully operational | Direct Shopify webhook intake (`orders/create`, `orders/updated`) and OAuth app store installation flow. |
| **Multi-Channel Fallback (WhatsApp / SMS)** | Interventions | `CustomerBehaviouralEventType` logs calling events; intervention tables exist | Automated trigger dispatching interactive WhatsApp confirmation buttons via Gupshup/Wati when voice calls reach max retries (`NO_ANSWER`). |
| **NDR & Courier Tracking Integration** | Logistics | Static mock views in `NdrRecoveryPage.jsx` | Integration with Indian 3PL APIs (Shiprocket, Delhivery, Bluedart, NimbusPost) for real-time Non-Delivery Report (NDR) tracking. |

---

## 4. Pending Production Activation Items (AI Calling Agent)

Before enabling live PSTN phone calls to real retail customers, the following four activation gates must be completed:

1. **DLT Entity & Caller ID KYC Registration:**
   - Complete Enterprise KYC on telecom DLT portals (Jio, Airtel, or Vodafone Idea).
   - Register the 140-series promotional/transactional Calling Line Identity (CLI).
   - Configure DLT Principal Entity ID (PEID) and Sender Header inside Vobiz / Exotel SIP trunks.
2. **Production LiveKit SIP Trunk Provisioning:**
   - Transition LiveKit Cloud or self-hosted LiveKit instance from staging to production.
   - Configure SIP Inbound/Outbound Trunks with carrier IP access control lists and digest credentials.
3. **Cloud Audio Egress Bucket (S3/R2):**
   - Provision an S3-compatible bucket (AWS S3 or Cloudflare R2) with strict retention policies.
   - Configure LiveKit Egress to stream recorded audio directly to the bucket and emit presigned URLs to `CallingWebhookController`.
4. **End-to-End PSTN Field Testing:**
   - Execute controlled test calls to whitelisted internal phone numbers across major Indian telecom circles (Airtel, Jio, Vi, BSNL).
   - Measure real-world STT word error rate (WER) and audio latency over 2G/4G cellular networks.

---

## 5. Next 10 Prioritised Development Tasks

```text
[Sprint Focus: Production Telephony, Storage Egress, Multi-Channel Fallback, and Logistics Integrations]
```

1. **Task 1 — LiveKit Audio Egress & S3/R2 Storage Integration**
   - Implement S3/R2 presigned URL generator in `voice-service`.
   - Connect LiveKit Egress service to record dual-channel audio and persist signed URLs into `call_sessions.recording_url`.

2. **Task 2 — Telecom DLT KYC & Vobiz / Exotel SIP Trunk Binding**
   - Bind production Indian telecom SIP trunks to LiveKit SIP Dispatch rules for E.164 `+91` outbound calls.
   - Validate CLI number masking and TRAI commercial communication compliance headers.

3. **Task 3 — Webhook Dead-Letter Queue (DLQ) & Retry Mechanism**
   - Implement transactional outbox or retry queue for `CallingWebhookController` to guarantee zero lost call outcomes during server restarts or network blips.

4. **Task 4 — Supervisor Live Eavesdropping (WebRTC In-Browser Listening)**
   - Expose LiveKit subscriber room tokens via `GET /api/v1/calling/sessions/{id}/listen-token` for `ADMIN` and `OWNER` roles.
   - Add LiveKit WebRTC audio stream player in `CallingIntelligencePage.jsx` for silent supervisor monitoring.

5. **Task 5 — WhatsApp Interactive Confirmation Fallback (Gupshup / Wati)**
   - Implement `WhatsAppInterventionService` triggering interactive quick-reply buttons ("Confirm Order", "Cancel Order", "Update Address") when call attempts terminate in `NO_ANSWER` or `BUSY`.

6. **Task 6 — Shopify App Direct Webhook Ingestion**
   - Complete `ShopifyWebhookController` with HMAC-SHA256 signature verification.
   - Auto-enroll incoming COD orders into the calling workflow in real time as checkouts complete.

7. **Task 7 — Indian 3PL Logistics Tracking (Shiprocket & Delhivery)**
   - Connect `NdrRecoveryPage.jsx` to live Shiprocket and Delhivery NDR webhooks.
   - Trigger automated AI voice re-delivery verification calls when a courier marks an order as "Customer Unavailable" or "Wrong Address".

8. **Task 8 — Redis Cache & Distributed Rate Limiting**
   - Integrate Redis for rate-limiting public endpoints (`/api/v1/auth/login`, `/api/v1/calling/webhooks/*`).
   - Cache Customer Intelligence aggregate summaries to accelerate page load on large customer directories (>50,000 customers).

9. **Task 9 — Cohort Analysis & Predictive Retention Modeling**
   - Upgrade `AnalyticsPage.jsx` with monthly buyer retention heatmaps and churn probability predictions derived from behavioral graph event counts.

10. **Task 10 — Automated End-to-End E2E Test Suite (Playwright)**
    - Build automated browser tests simulating complete user journeys: Registration $\rightarrow$ Workspace Switch $\rightarrow$ CSV Order Import $\rightarrow$ Calling Queue Dispatch $\rightarrow$ Customer 360 Graph Inspection.

---

## 6. Verification Status & Test Evidence

- **Frontend Compilation:**
  ```text
  vite v6.4.6 building for production...
  ✓ 2391 modules transformed.
  dist/index.html                     0.91 kB │ gzip:   0.52 kB
  dist/assets/index-BANlbEV6.css     67.12 kB │ gzip:  11.88 kB
  dist/assets/index-CcQzIzoh.js   1,118.58 kB │ gzip: 304.15 kB
  ✓ built in 11.44s (0 errors)
  ```
- **Backend Test Suite:**
  ```text
  [INFO] Tests run: 54, Failures: 0, Errors: 0, Skipped: 1
  [INFO] BUILD SUCCESS
  ```
- **Cloud Database Migrations Applied:**
  ```text
  V1__init_foundation_metadata.sql
  V2__init_merchants_users_and_memberships.sql
  V3__init_customers_orders_and_history.sql
  V4__customer_intelligence.sql
  V5__ai_calling_agent.sql
  ```
- **Live Background Daemons:**
  - `PostgreSQL 18 Local Daemon` (port 5433)
  - `Spring Boot Monolith` (port 8080, `supabase` active profile)
  - `Stateless Voice Service` (port 3104, `DRY_RUN` mode)

---
*Roadmap maintained under NORTHSTAR Engineering Standards. Navigate Commerce with Clarity.*
