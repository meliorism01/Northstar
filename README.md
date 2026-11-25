# ORDEXA — AI-Powered Order Management & RTO Intelligence Platform

ORDEXA is a multi-tenant Order Management and Return-to-Origin (RTO) Intelligence SaaS platform engineered for Indian D2C brands, e-commerce storefronts, and social-commerce merchants.

The platform is built around three core layers:
1. **Multi-Tenant Merchant Workspace & Security Foundation (Live PostgreSQL + Spring Security):** Provides transactional merchant registration, BCrypt password hashing, short-lived workspace-scoped JWT access tokens, rotated `HttpOnly` SHA-256 hashed refresh cookies with replay detection, role-based access control (`OWNER`, `ADMIN`, `MANAGER`, `OPERATOR`, `VIEWER`), and strict cross-tenant data isolation.
2. **Database-Backed Order & Customer Management Core (Milestone 3):** Implements merchant-scoped customers (`UNIQUE (merchant_id, phone_number)`), multi-item orders (`UNIQUE (merchant_id, order_number)`), server-calculated `BigDecimal` monetary arithmetic, controlled order lifecycle state machine (`CREATED -> CONFIRMED -> PROCESSING -> SHIPPED -> DELIVERED` + `CANCELLED`), immutable status audit trail (`order_status_history`), safe deletion rules, and bulk CSV order importing with row-level validation reporting.
3. **Complete Customer Intelligence Graph & Behavioral Analytics Engine (Milestone 4):** Transforms PostgreSQL transactional records into merchant-scoped Customer 360 behavioral profiles, 7 deterministic and explainable customer segments (`NEW_CUSTOMER`, `REPEAT_CUSTOMER`, `HIGH_VALUE_CUSTOMER`, `INACTIVE_CUSTOMER`, `CANCELLATION_PRONE_CUSTOMER`, `COD_HEAVY_CUSTOMER`, `LOYAL_CUSTOMER`), product performance & co-purchase combinations, chronological purchase timelines (`customer_behavioural_events` + `order_status_history`), and an interactive `CUSTOMER`-`ORDER`-`PRODUCT`-`SEGMENT` relationship graph.
4. **Explainable AI RTO Rescue Engine (Scheduled for Milestone 5+):** Evaluates pre-dispatch order risk, assigns `LOW`, `MEDIUM`, and `HIGH` attention bands with transparent reason codes, and orchestrates proportionate buyer verification.

---

## 1. Repository Architecture

```text
ordexa/
├── docker-compose.yml               # PostgreSQL 16 (persistent volume + healthcheck) & optional backend container
├── .env.example                     # Safe placeholder environment variables (DB, JWT, Refresh Cookies, CORS, Vite)
├── package.json                     # Frontend dependencies & scripts (React 18 + Vite 6 + Tailwind CSS + Zustand)
├── vite.config.js                   # Vite dev server (port 5173) with /api reverse proxy to Spring Boot (port 8080)
├── src/
│   ├── services/api/                # apiClient.js, authApi.js, workspaceApi.js, ordersApi.js, customersApi.js
│   ├── store/useAuthStore.js        # Dedicated multi-tenant authentication & workspace state store
│   ├── store/useOrdexaStore.js      # Operational demo sandbox store (Rescue, NDR, Analytics & Financial sandboxes)
│   ├── components/auth/             # ProtectedRoute.jsx (session restoration, workspace guard & RBAC check)
│   ├── pages/auth/                  # RegisterPage.jsx, LoginPage.jsx, WorkspaceSelectPage.jsx
│   └── pages/                       # LandingPage + 9 Merchant Console Modules (Orders, Customers & Dashboard connected to PostgreSQL)
├── server/                          # Spring Boot 3.4.3 Modular Monolith Backend
│   ├── pom.xml                      # Maven configuration (Spring Boot 3.4.3, Spring Security, JJWT 0.12.6, Flyway, PostgreSQL)
│   ├── mvnw / mvnw.cmd              # Maven Wrapper scripts (Maven 3.9.9)
│   ├── Dockerfile                   # Multi-stage Java 21 LTS container build
│   ├── src/main/java/com/ordexa/    # Modular packages: auth, merchant, user, membership, tenant, customer, order, config, common, health
│   ├── src/main/resources/          # Profile YAML configs & Flyway SQL migrations (V1, V2, V3)
│   └── src/test/java/com/ordexa/    # Unit, MockMvc integration, live PostgreSQL & Testcontainers test suites
└── docs/
    └── BACKEND_ARCHITECTURE.md      # Architecture reference: JWT lifecycle, RBAC, Order Lifecycle, CSV import & tenant isolation
```

---

## 2. Database Schema (Flyway Migrations V1, V2 & V3)

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
- **`V3__init_customers_orders_and_history.sql`:**
  - `customers`: `id` (UUID PK), `merchant_id` (FK), `full_name`, `phone_number`, `email`, `default_shipping_address`, `city`, `state`, `postal_code`, `country`, `created_at`, `updated_at`, `UNIQUE (merchant_id, phone_number)`.
  - `orders`: `id` (UUID PK), `merchant_id` (FK), `order_number`, `customer_id` (FK), `source` (`MANUAL`, `SHOPIFY`, `WOOCOMMERCE`, `CSV`), `order_status` (`CREATED`, `CONFIRMED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`), `payment_status` (`PENDING`, `PAID`, `PARTIALLY_PAID`, `REFUNDED`, `FAILED`), `payment_method` (`COD`, `PREPAID`, `UPI`, `CARD`, `NETBANKING`, `WALLET`), `subtotal` (`NUMERIC(14,2)`), `discount` (`NUMERIC(14,2)`), `shipping_fee` (`NUMERIC(14,2)`), `total_amount` (`NUMERIC(14,2)`), `currency`, `shipping_address`, `billing_address`, `customer_notes`, `version` (`BIGINT` optimistic lock), `created_at`, `updated_at`, `UNIQUE (merchant_id, order_number)`.
  - `order_items`: `id` (UUID PK), `merchant_id` (FK), `order_id` (FK), `product_name`, `sku`, `quantity`, `unit_price` (`NUMERIC(14,2)`), `total_price` (`NUMERIC(14,2)`).
  - `order_status_history`: `id` (UUID PK), `merchant_id` (FK), `order_id` (FK), `previous_status`, `new_status`, `changed_by_user_id` (FK), `reason`, `created_at`.

- **`V4__customer_intelligence.sql`:**
  - `customer_behavioural_events`: `id` (UUID PK), `merchant_id` (FK), `customer_id` (FK), `order_id` (FK), `event_type` (`CUSTOMER_CREATED`, `CUSTOMER_PROFILE_UPDATED`, `REPEAT_PURCHASE`, `PAYMENT_COMPLETED`), `title`, `description`, `occurred_at`.
  - Composite performance indexes on `order_items (merchant_id, sku)`, `order_items (merchant_id, order_id, sku)`, and `orders (merchant_id, customer_id, order_status, created_at DESC)`.

---

## 3. REST APIs (`/api/v1`)

### Authentication & Workspace APIs
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

### Order & Customer Management APIs (Milestone 3)
| Method & Endpoint | Access | Description |
| :--- | :--- | :--- |
| `GET /api/v1/orders` | Workspace Role >= `VIEWER` | Lists workspace orders with search (`orderNumber`, `customerName`, `phone`), status/payment/date filters, pagination, and sorting |
| `GET /api/v1/orders/{id}` | Workspace Role >= `VIEWER` | Returns full order details, line items, customer summary, allowed status transitions, and `order_status_history` timeline |
| `POST /api/v1/orders` | Workspace Role >= `OPERATOR` | Creates a new order with server-calculated `BigDecimal` totals, automatic merchant-scoped customer lookup/creation, and initial status history entry |
| `PATCH /api/v1/orders/{id}` | Workspace Role >= `OPERATOR` | Updates order payment status/method, addresses, notes, discount, or shipping fee and recalculates `totalAmount` |
| `POST /api/v1/orders/{id}/status` | Workspace Role >= `OPERATOR` | Transitions order status along the controlled lifecycle state machine and appends an immutable `OrderStatusHistory` record |
| `DELETE /api/v1/orders/{id}` | Workspace Role >= `MANAGER` | Safely deletes an order only if its current status is `CREATED` or `CANCELLED` (rejects `CONFIRMED`, `PROCESSING`, `SHIPPED`, `DELIVERED` with `422 ORDER_DELETION_NOT_ALLOWED`) |
| `POST /api/v1/orders/import-csv` | Workspace Role >= `OPERATOR` | Parses CSV text payload, validates required columns, phone numbers, monetary values, and duplicate order numbers, imports valid orders, and returns `CsvImportSummaryDto` |
| `POST /api/v1/orders/import-csv/file` | Workspace Role >= `OPERATOR` | Multipart file upload variant for bulk CSV order import |
| `GET /api/v1/customers` | Workspace Role >= `VIEWER` | Lists merchant-scoped customers with search (`fullName`, `phoneNumber`, `email`), order counts, and pagination |
| `GET /api/v1/customers/{id}` | Workspace Role >= `VIEWER` | Returns customer profile and lifetime order metrics (`orderCount`, `totalSpent`, `deliveredCount`, `cancelledCount`) |
| `GET /api/v1/customers/{id}/orders` | Workspace Role >= `VIEWER` | Returns paginated order history for a specific customer within the active merchant workspace |

### Customer Intelligence Graph APIs (Milestone 4)
| Method & Endpoint | Access | Description |
| :--- | :--- | :--- |
| `GET /api/v1/intelligence/overview` | Workspace Role >= `VIEWER` | Returns merchant-scoped customer intelligence KPIs (total, new, repeat, high-value, inactive, loyal, avg CLV, AOV, repeat %, cancellation %) and segment distribution |
| `GET /api/v1/intelligence/graph` | Workspace Role >= `VIEWER` | Generates the merchant-scoped `CUSTOMER`, `ORDER`, `PRODUCT`, and `SEGMENT` relationship graph with `PLACED`, `CONTAINS`, `BELONGS_TO`, `REPEATEDLY_PURCHASED`, and `RELATED_TO` edges |
| `GET /api/v1/intelligence/customers` | Workspace Role >= `VIEWER` | Paginated, filterable customer intelligence directory (`search`, `segment`, `minOrders`, `maxOrders`, `minSpend`, `maxDaysSinceLastOrder`, `sortBy`, `sortDir`) |
| `GET /api/v1/intelligence/customers/{customerId}` | Workspace Role >= `VIEWER` | Complete Customer 360 profile: purchase metrics, payment behaviour, order outcomes, explainable segments, product preferences, timeline, relationships, and subgraph |
| `GET /api/v1/intelligence/customers/{customerId}/graph` | Workspace Role >= `VIEWER` | Dedicated single-customer relationship graph: 1 central `CUSTOMER` node, their `ORDER` nodes, consolidated `PRODUCT` nodes, and assigned `SEGMENT` nodes |
| `GET /api/v1/intelligence/customers/{customerId}/segments` | Workspace Role >= `VIEWER` | Returns explainable behavioral segment assignments and evidence for a customer |
| `GET /api/v1/intelligence/customers/{customerId}/timeline` | Workspace Role >= `VIEWER` | Returns chronological order lifecycle and behavioral event timeline for a customer |
| `GET /api/v1/intelligence/customers/{customerId}/products` | Workspace Role >= `VIEWER` | Returns product preferences and repeated SKUs for a customer |
| `GET /api/v1/intelligence/segments` | Workspace Role >= `VIEWER` | Lists all 7 deterministic behavioral segments, rules, customer counts, and spend metrics |
| `GET /api/v1/intelligence/segments/{segmentId}` | Workspace Role >= `VIEWER` | Returns summary metrics and rule definition for a specific segment |
| `GET /api/v1/intelligence/segments/{segmentId}/customers` | Workspace Role >= `VIEWER` | Lists paginated customers belonging to a specific behavioral segment |
| `GET /api/v1/intelligence/products` | Workspace Role >= `VIEWER` | Lists SKU-level product intelligence (units sold, revenue, unique buyers, repeat buyer rate) |
| `GET /api/v1/intelligence/products/{sku}` | Workspace Role >= `VIEWER` | Returns product intelligence detail, customer buyers list, and co-purchased SKUs |
| `GET /api/v1/intelligence/products/co-purchases` | Workspace Role >= `VIEWER` | Computes explainable product co-purchase pairs with same-order count, shared customer count, and support % |

---

## 4. Controlled Order Lifecycle & CSV Import Format

### Order Lifecycle State Machine
- **Valid Transitions:**
  - `CREATED` -> `CONFIRMED`, `CANCELLED`
  - `CONFIRMED` -> `PROCESSING`, `CANCELLED`
  - `PROCESSING` -> `SHIPPED`, `CANCELLED`
  - `SHIPPED` -> `DELIVERED`
  - `DELIVERED` -> *(terminal state)*
  - `CANCELLED` -> *(terminal state)*
- Any other transition (e.g., `CREATED -> DELIVERED` or `DELIVERED -> CANCELLED`) is rejected with `422 Unprocessable Entity` (`INVALID_STATUS_TRANSITION`).
- **Safe Deletion Policy:** Only orders in `CREATED` or `CANCELLED` status can be deleted (`DELETE /api/v1/orders/{id}`, requires `MANAGER`, `ADMIN`, or `OWNER`). Orders that have progressed to `CONFIRMED`, `PROCESSING`, `SHIPPED`, or `DELIVERED` must be preserved for financial and operational audit integrity.

### CSV Order Import Columns
Required CSV header columns (case-insensitive):
`customer_name,customer_phone,product_name,sku,quantity,unit_price,payment_method,shipping_address`
Optional columns:
`order_number,customer_email,payment_status,discount,shipping_fee,billing_address,customer_notes,city,state,postal_code,country,currency`

---

## 5. Running the Full Stack Locally

### Step 1 — PostgreSQL (Local Port 5433 or Docker Port 5432)
```powershell
# If using Docker Compose:
docker compose up -d postgres
```
*(On Windows workstations with PostgreSQL 18 installed locally, the local cluster runs on `127.0.0.1:5433` with database `ordexa_db` and user `ordexa_app`, which is pre-configured as the default in `application-local.yml`.)*

### Step 2 — Run Backend Tests & Start Spring Boot Server
```powershell
cd server
.\mvnw.cmd test -B
.\mvnw.cmd spring-boot:run
```
- Backend API: `http://127.0.0.1:8080/api/v1/health`
- Swagger UI: `http://127.0.0.1:8080/swagger-ui.html`

### Step 3 — Start React Frontend
```powershell
npm run dev
```
- Public Landing Page: `http://127.0.0.1:5173/`
- Protected Merchant Console: `http://127.0.0.1:5173/app/orders`

---

## 6. Database Configuration (Local vs. Supabase Cloud)

ORDEXA supports both **Local PostgreSQL** and **Supabase Cloud PostgreSQL** (Shared Pooler — Session Mode with `sslmode=require`) via Spring Boot profiles and environment variables—no code changes required:

- **Local PostgreSQL (default):** `SPRING_PROFILES_ACTIVE=local` connects to `127.0.0.1:5433/ordexa_db`.
- **Supabase Cloud PostgreSQL:** Set `SPRING_PROFILES_ACTIVE=supabase` and supply `SUPABASE_DB_PASSWORD` (or `SPRING_DATASOURCE_PASSWORD`) via your local `.env` or shell environment.

See [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) for full setup instructions, [docs/SUPABASE_MIGRATION_AUDIT.md](docs/SUPABASE_MIGRATION_AUDIT.md) for the architecture audit, and [docs/LOCAL_TO_SUPABASE_DATA_MIGRATION.md](docs/LOCAL_TO_SUPABASE_DATA_MIGRATION.md) for backup and data migration procedures.
