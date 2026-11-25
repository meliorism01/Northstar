# ORDEXA — AI-Powered Order Management & RTO Intelligence Platform

ORDEXA is a multi-tenant Order Management and Return-to-Origin (RTO) Intelligence SaaS platform engineered for Indian D2C brands, e-commerce storefronts, and social-commerce merchants.

The platform is built around three core layers:
1. **Multi-Tenant Merchant Workspace & Security Foundation (Live PostgreSQL + Spring Security):** Provides transactional merchant registration, BCrypt password hashing, short-lived workspace-scoped JWT access tokens, rotated `HttpOnly` SHA-256 hashed refresh cookies with replay detection, role-based access control (`OWNER`, `ADMIN`, `MANAGER`, `OPERATOR`, `VIEWER`), and strict cross-tenant data isolation.
2. **Merchant-Scoped Customer Intelligence Graph:** Connects customers, orders, owned stores, delivery addresses, landmark history, and delivery outcomes within a single merchant's workspace without cross-merchant blacklists or unsafe automatic merges.
3. **Explainable AI RTO Rescue Engine:** Evaluates pre-dispatch order risk, assigns `LOW`, `MEDIUM`, and `HIGH` attention bands with transparent reason codes (`ADDRESS_INCOMPLETE`, `CONFIRMATION_PENDING`, `HIGH_VALUE_ORDER`, `REPEATED_COD_REFUSAL`, `PRIOR_DELIVERY_EXCEPTION`, `NEW_CUSTOMER`), and orchestrates proportionate buyer verification.

---

## 1. Repository Architecture

```text
ordexa/
├── docker-compose.yml               # PostgreSQL 16 (persistent volume + healthcheck) & optional backend container
├── .env.example                     # Safe placeholder environment variables (DB, JWT, Refresh Cookies, CORS, Vite)
├── package.json                     # Frontend dependencies & scripts (React 18 + Vite 6 + Tailwind CSS + Zustand)
├── vite.config.js                   # Vite dev server (port 5173) with /api reverse proxy to Spring Boot (port 8080)
├── src/
│   ├── services/api/                # apiClient.js (single-flight refresh, in-memory JWT), authApi.js, workspaceApi.js
│   ├── store/useAuthStore.js        # Dedicated multi-tenant authentication & workspace state store
│   ├── store/useOrdexaStore.js      # Operational order, customer graph, NDR & sandbox store
│   ├── components/auth/             # ProtectedRoute.jsx (session restoration, workspace guard & RBAC check)
│   ├── pages/auth/                  # RegisterPage.jsx, LoginPage.jsx, WorkspaceSelectPage.jsx
│   └── pages/                       # LandingPage + 9 Merchant Console Modules (Dashboard, Orders, Graph, Rescue, NDR, Analytics, Financial, Integrations, Settings)
├── server/                          # Spring Boot 3.4.3 Modular Monolith Backend
│   ├── pom.xml                      # Maven configuration (Spring Boot 3.4.3, Spring Security, JJWT 0.12.6, Flyway, PostgreSQL)
│   ├── mvnw / mvnw.cmd              # Maven Wrapper scripts (Maven 3.9.9)
│   ├── Dockerfile                   # Multi-stage Java 21 LTS container build
│   ├── src/main/java/com/ordexa/    # Modular packages: auth, merchant, user, membership, tenant, config, common, health
│   ├── src/main/resources/          # Profile YAML configs & Flyway SQL migrations (V1 + V2)
│   └── src/test/java/com/ordexa/    # Unit, MockMvc integration, live PostgreSQL & Testcontainers test suites
└── docs/
    └── BACKEND_ARCHITECTURE.md      # Architecture reference: JWT lifecycle, refresh rotation, RBAC & tenant isolation
```

---

## 2. Database Schema (Flyway Migrations V1 & V2)

Hibernate automatic DDL creation is disabled (`spring.jpa.hibernate.ddl-auto=validate`). All schema changes are managed strictly by Flyway:
- **`V1__init_foundation_metadata.sql`:**
  - `system_bootstrap_audit`: Verifies Flyway-to-Hibernate schema validation on startup.
- **`V2__init_merchants_users_and_memberships.sql`:**
  - `merchants`: `id` (UUID PK), `business_name`, `business_slug` (UNIQUE), `status` (`ACTIVE`, `SUSPENDED`, `ARCHIVED`), `created_at`, `updated_at`.
  - `users`: `id` (UUID PK), `full_name`, `email` (UNIQUE normalized lowercase), `password_hash` (BCrypt), `status` (`ACTIVE`, `INACTIVE`, `LOCKED`), `created_at`, `updated_at`.
  - `merchant_memberships`: `id` (UUID PK), `merchant_id` (FK), `user_id` (FK), `role` (`OWNER`, `ADMIN`, `MANAGER`, `OPERATOR`, `VIEWER`), `status` (`ACTIVE`, `INVITED`, `REVOKED`), `UNIQUE (merchant_id, user_id)`.
  - `authentication_sessions`: `id` (UUID PK), `user_id` (FK), `active_merchant_id` (FK), `status` (`ACTIVE`, `REVOKED`, `EXPIRED`), `ip_address`, `user_agent`, `expires_at`, `revoked_at`.
  - `refresh_tokens`: `id` (UUID PK), `user_id` (FK), `token_hash` (UNIQUE SHA-256 hex digest—never plaintext), `session_id` (FK), `expires_at`, `revoked_at`, `replaced_by_token_id` (FK).
  - `audit_logs`: `id` (UUID PK), `merchant_id` (FK), `actor_user_id` (FK), `action`, `target_type`, `target_id`, `details`, `ip_address`, `created_at`.

---

## 3. Authentication, Workspace & Multi-Tenant APIs

| Method & Endpoint | Access | Description |
| :--- | :--- | :--- |
| `GET /api/v1/health` | Public | Live JDBC probe returning `200 OK` (`UP` / `CONNECTED`) or `503` (`DOWN` / `DISCONNECTED`) |
| `POST /api/v1/auth/register` | Public (Rate-Limited) | Transactional creation of `Merchant`, `User` (BCrypt hash), and `OWNER` `MerchantMembership` |
| `POST /api/v1/auth/login` | Public (Rate-Limited) | Authenticates user, issues in-memory JWT access token + `HttpOnly` refresh cookie |
| `POST /api/v1/auth/refresh` | Cookie + CSRF Origin Check | Rotates refresh token, detects replay attacks, and issues a fresh JWT access token |
| `POST /api/v1/auth/logout` | Public / Authenticated | Revokes `AuthenticationSession` & refresh tokens in PostgreSQL and clears `HttpOnly` cookie |
| `GET /api/v1/auth/workspaces` | Authenticated JWT | Lists all active merchant workspaces and roles for the authenticated user |
| `POST /api/v1/auth/select-workspace` | Authenticated JWT | Verifies PostgreSQL membership, updates session workspace, and issues workspace-scoped JWT |
| `GET /api/v1/users/me` | Authenticated JWT | Returns the authenticated operator profile |
| `GET /api/v1/merchants/current` | Workspace Role >= `VIEWER` | Returns active merchant workspace details |
| `GET /api/v1/merchants/{merchantId}` | Workspace Role >= `VIEWER` | Returns workspace details only if `merchantId` matches the active authenticated tenant |
| `PATCH /api/v1/merchants/{merchantId}` | Workspace Role == `OWNER` | Updates merchant business name (`OWNER` only) |
| `GET /api/v1/merchants/{merchantId}/members` | Workspace Role >= `VIEWER` | Lists team members for the active merchant workspace |
| `POST /api/v1/merchants/{merchantId}/members` | Workspace Role >= `ADMIN` | Adds or invites a user to the active merchant workspace with a specified role |

---

## 4. Role-Based Access Control (RBAC) Matrix

| Role | Rank | Granted Capabilities |
| :--- | :---: | :--- |
| `OWNER` | 5 | Full workspace control, rename workspace, manage all roles including `OWNER` and `ADMIN` |
| `ADMIN` | 4 | Administrative & team membership management (`ADMIN`, `MANAGER`, `OPERATOR`, `VIEWER`), operational workflows |
| `MANAGER` | 3 | Manage operational workflows, scoring rules, and exception queues |
| `OPERATOR` | 2 | Execute assigned order verification and NDR recovery tasks |
| `VIEWER` | 1 | Read-only access to workspace dashboards, members, and analytics |

---

## 5. Running the Full Stack Locally

### Option A — Local PostgreSQL Cluster (Port 5433) or Docker Compose (Port 5432)
```powershell
# Start PostgreSQL via Docker Compose (if using Docker Desktop):
docker compose up -d postgres
```
*(On Windows workstations with PostgreSQL 18 installed locally, the local cluster runs on `127.0.0.1:5433` with database `ordexa_db` and user `ordexa_app`, which is pre-configured as the default in `application-local.yml`.)*

### Step 2 — Run Backend Tests & Start Spring Boot Server
```powershell
cd server
.\mvnw.cmd clean verify
.\mvnw.cmd spring-boot:run
```
- Backend API: `http://127.0.0.1:8080/api/v1/health`
- Swagger UI: `http://127.0.0.1:8080/swagger-ui.html`

### Step 3 — Start React Frontend
In a second terminal from the repository root:
```powershell
npm run dev
```
- Public Landing Page: `http://127.0.0.1:5173/`
- Merchant Registration: `http://127.0.0.1:5173/register`
- Merchant Sign In: `http://127.0.0.1:5173/login`
- Workspace Picker: `http://127.0.0.1:5173/workspaces`
- Protected Merchant Console: `http://127.0.0.1:5173/app/dashboard`
