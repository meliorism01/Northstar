# ORDEXA — Backend Architecture & Multi-Tenant Security Reference

## 1. End-to-End Authentication & Workspace Lifecycle

```text
  [React Frontend]                                 [Spring Boot Backend]                     [PostgreSQL 16/18]
         |                                                   |                                       |
         |--- 1. POST /api/v1/auth/register ---------------->|                                       |
         |       {businessName, ownerName, email, password}  |-- Validate & BCrypt Hash ------------>|
         |                                                   |-- INSERT merchants, users,            |
         |                                                   |   merchant_memberships (OWNER),       |
         |                                                   |   audit_logs (Single Transaction) --->|
         |<-- 201 Created (UserProfile + WorkspaceSummary) --|                                       |
         |                                                   |                                       |
         |--- 2. POST /api/v1/auth/login ------------------->|                                       |
         |       {email, password}                           |-- Verify BCrypt & UserStatus=ACTIVE ->|
         |                                                   |-- Load active memberships ----------->|
         |                                                   |-- INSERT authentication_sessions &    |
         |                                                   |   SHA-256 refresh_tokens ------------>|
         |<-- 200 OK (In-Memory JWT + HttpOnly Cookie) ------|                                       |
         |                                                   |                                       |
         |--- 3. POST /api/v1/auth/select-workspace -------->|                                       |
         |       Authorization: Bearer <jwt>                 |-- Verify active membership in DB ---->|
         |       {merchantId}                                |-- Update session.active_merchant_id ->|
         |<-- 200 OK (Workspace-Scoped JWT with mid & role) -|                                       |
         |                                                   |                                       |
         |--- 4. GET/PATCH /api/v1/merchants/{merchantId} -->|                                       |
         |       Authorization: Bearer <scoped-jwt>          |-- JwtAuthenticationFilter checks      |
         |                                                   |   session=ACTIVE & membership=ACTIVE  |
         |                                                   |-- @PreAuthorize("@tenantAuth...")     |
         |                                                   |   verifies tenant match & role rank ->|
         |<-- 200 OK (or 403 TENANT_ACCESS_DENIED) ----------|                                       |
```

---

## 2. Database Schema & Constraints (`V2__init_merchants_users_and_memberships.sql`)

### Tables Created in V2
1. **`merchants`**:
   - Primary Key: `id UUID`
   - Unique Constraint: `uq_merchants_business_slug UNIQUE (business_slug)`
   - Status Check: `chk_merchants_status CHECK (status IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED'))`
2. **`users`**:
   - Primary Key: `id UUID`
   - Unique Constraint: `uq_users_email UNIQUE (email)` (normalized lowercase)
   - Status Check: `chk_users_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'LOCKED'))`
3. **`merchant_memberships`**:
   - Primary Key: `id UUID`
   - Foreign Keys: `merchant_id REFERENCES merchants(id) ON DELETE CASCADE`, `user_id REFERENCES users(id) ON DELETE CASCADE`
   - Unique Constraint: `uq_memberships_merchant_user UNIQUE (merchant_id, user_id)`
   - Role Check: `chk_memberships_role CHECK (role IN ('OWNER', 'ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER'))`
4. **`authentication_sessions`**:
   - Primary Key: `id UUID`
   - Foreign Keys: `user_id REFERENCES users(id) ON DELETE CASCADE`, `active_merchant_id REFERENCES merchants(id) ON DELETE SET NULL`
   - Tracks session status (`ACTIVE`, `REVOKED`, `EXPIRED`), client IP, user agent, and expiration.
5. **`refresh_tokens`**:
   - Primary Key: `id UUID`
   - Unique Constraint: `uq_refresh_tokens_token_hash UNIQUE (token_hash)` (64-char SHA-256 hex digest)
   - Rotation Lineage: `replaced_by_token_id REFERENCES refresh_tokens(id) ON DELETE SET NULL`
6. **`audit_logs`**:
   - Primary Key: `id UUID`
   - Immutable security trail for `MERCHANT_REGISTERED`, `USER_LOGIN`, `WORKSPACE_SELECTED`, `MERCHANT_UPDATED`, `MEMBER_ADDED`, `CROSS_TENANT_ACCESS_BLOCKED`, `REFRESH_TOKEN_REPLAY_DETECTED`, and `USER_LOGOUT`.

---

## 3. Token Storage, CSRF & Session Revocation Strategy

- **In-Memory Access Tokens:** The React frontend (`src/services/api/apiClient.js`) stores the JWT access token strictly in a module-private JavaScript variable (`inMemoryAccessToken`) and never writes it to `localStorage` or `sessionStorage`.
- **HttpOnly Refresh Cookie:** The refresh token is stored in an `HttpOnly` cookie (`ordexa_refresh_token`) scoped to `Path=/api/v1/auth` with `SameSite=Lax` (or `Strict` in production) and `Secure=true` in production.
- **CSRF Origin Enforcement:** `AuthController.verifyCookieCsrfOrigin` validates the `Origin` header on cookie-authenticated endpoints (`/api/v1/auth/refresh` and `/api/v1/auth/logout`) against the configured `ordexa.cors.allowed-origins` list, rejecting cross-site requests with `403 CSRF_PROTECTION_FAILED`.
- **Single-Flight Refresh Queue:** When an access token expires or the user reloads the browser tab, `ProtectedRoute` and `apiClient.js` execute a single shared `refreshAccessTokenSingleFlight()` call so concurrent API calls never race or trigger false replay alarms.
- **Immediate Session Revocation:** Because `JwtAuthenticationFilter` checks `AuthenticationSession.status == ACTIVE` against PostgreSQL, logging out or triggering refresh replay invalidates existing JWT access tokens immediately without waiting for the 15-minute JWT TTL to elapse.

---

## 4. Current Scope & Remaining Milestones

- **Implemented & Verified in Milestone 2:**
  - Full PostgreSQL persistence for merchants, users, memberships, sessions, rotated refresh tokens, and audit logs.
  - End-to-end React registration, login, session restoration, multi-workspace switching, RBAC enforcement, logout, and cross-tenant isolation.
- **Scheduled for Milestone 3+:**
  - Persisting storefronts, orders, customer intelligence graph nodes/edges, risk assessments, and interventions in PostgreSQL (`V3__...`, `V4__...`) to replace the remaining in-browser operational order sandbox (`useOrdexaStore.js`).
