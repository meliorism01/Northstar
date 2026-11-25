# ORDEXA — Backend Architecture, Multi-Tenant Security & Order Management Reference

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
         |--- 4. POST /api/v1/orders ----------------------->|                                       |
         |       Authorization: Bearer <scoped-jwt>          |-- JwtAuthenticationFilter resolves    |
         |                                                   |   TenantContext (merchantId + role)   |
         |                                                   |-- Upsert merchant-scoped Customer --->|
         |                                                   |-- Compute BigDecimal totals --------->|
         |                                                   |-- INSERT orders, order_items,         |
         |                                                   |   order_status_history -------------->|
         |<-- 201 Created (OrderDetailDto) ------------------|                                       |
```

---

## 2. Database Schema & Constraints (`V1`, `V2`, `V3`)

### Tables Created in V2 (`V2__init_merchants_users_and_memberships.sql`)
1. **`merchants`**: `id UUID PK`, `uq_merchants_business_slug UNIQUE (business_slug)`, `status IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED')`.
2. **`users`**: `id UUID PK`, `uq_users_email UNIQUE (email)` (lowercase), `password_hash` (BCrypt), `status IN ('ACTIVE', 'INACTIVE', 'LOCKED')`.
3. **`merchant_memberships`**: `id UUID PK`, `uq_memberships_merchant_user UNIQUE (merchant_id, user_id)`, `role IN ('OWNER', 'ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER')`.
4. **`authentication_sessions`**: Tracks active login sessions (`ACTIVE`, `REVOKED`, `EXPIRED`) and `active_merchant_id`.
5. **`refresh_tokens`**: Stores only SHA-256 hex digests (`token_hash`) and rotation lineage (`replaced_by_token_id`).
6. **`audit_logs`**: Immutable security and operational audit log.

### Tables Created in V3 (`V3__init_customers_orders_and_history.sql`)
1. **`customers`**:
   - Primary Key: `id UUID`
   - Tenant Scope: `merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE`
   - Unique Constraint: `uq_customers_merchant_phone UNIQUE (merchant_id, phone_number)` (never globally unique across merchants)
   - Indexes: `(merchant_id, created_at DESC)`, `(merchant_id, lower(full_name))`, `(merchant_id, phone_number)`
2. **`orders`**:
   - Primary Key: `id UUID`
   - Tenant Scope: `merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE`
   - Customer Reference: `customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT`
   - Unique Constraint: `uq_orders_merchant_order_number UNIQUE (merchant_id, order_number)`
   - Monetary Columns: `subtotal NUMERIC(14,2)`, `discount NUMERIC(14,2)`, `shipping_fee NUMERIC(14,2)`, `total_amount NUMERIC(14,2)` with non-negative check constraints
   - Concurrency Control: `version BIGINT NOT NULL DEFAULT 0` (`@Version` optimistic locking)
   - Indexes: `(merchant_id, created_at DESC)`, `(merchant_id, order_status, created_at DESC)`, `(merchant_id, payment_status, created_at DESC)`, `(merchant_id, customer_id, created_at DESC)`
3. **`order_items`**:
   - Primary Key: `id UUID`
   - Foreign Keys: `merchant_id REFERENCES merchants(id) ON DELETE CASCADE`, `order_id REFERENCES orders(id) ON DELETE CASCADE`
   - Monetary Columns: `unit_price NUMERIC(14,2)`, `total_price NUMERIC(14,2)`
4. **`order_status_history`**:
   - Primary Key: `id UUID`
   - Foreign Keys: `merchant_id REFERENCES merchants(id) ON DELETE CASCADE`, `order_id REFERENCES orders(id) ON DELETE CASCADE`, `changed_by_user_id REFERENCES users(id) ON DELETE SET NULL`
   - Audit Fields: `previous_status`, `new_status`, `reason`, `created_at`

---

## 3. Order Lifecycle & Safe Deletion Architecture

```text
   +---------+       +-----------+       +------------+       +---------+       +-----------+
   | CREATED | ----> | CONFIRMED | ----> | PROCESSING | ----> | SHIPPED | ----> | DELIVERED |
   +---------+       +-----------+       +------------+       +---------+       +-----------+
        |                  |                   |
        +------------------+-------------------+
                           |
                           v
                     +-----------+
                     | CANCELLED |
                     +-----------+
```

- **State Enforcement:** `OrderStatus.canTransitionTo(OrderStatus target)` defines the exact allowed transitions. Invalid transitions return `422 Unprocessable Entity` (`errorCode: "INVALID_STATUS_TRANSITION"`).
- **Safe Deletion Policy:** `DELETE /api/v1/orders/{id}` is restricted to `MANAGER`, `ADMIN`, and `OWNER` roles and is only permitted when `order.getOrderStatus().isDeletable()` is `true` (`CREATED` or `CANCELLED`). Attempting to delete an order in `CONFIRMED`, `PROCESSING`, `SHIPPED`, or `DELIVERED` status returns `422 Unprocessable Entity` (`errorCode: "ORDER_DELETION_NOT_ALLOWED"`).
- **CSV Order Import Engine (`CsvOrderImportService`):**
  - Supports multi-line rows for the same `order_number` within a CSV batch (aggregating line items into a single multi-item order).
  - Validates required headers, Indian/E.164 phone numbers, positive quantities, non-negative `BigDecimal` prices, and duplicate order numbers against existing merchant orders in PostgreSQL.
  - Imports valid orders while returning a comprehensive `CsvImportSummaryDto` (`totalRowsProcessed`, `importedOrdersCount`, `failedRowsCount`, `errors[]`, `importedOrders[]`) so failed rows are never silently discarded.

---

## 4. Customer Intelligence Graph Engine (`V4__customer_intelligence.sql`)

See [CUSTOMER_INTELLIGENCE_ARCHITECTURE.md](file:///c:/Users/MANIK%20MEHRA/ordexa/docs/CUSTOMER_INTELLIGENCE_ARCHITECTURE.md) for the complete reference covering:
- `customer_behavioural_events` schema and V4 aggregation indexes.
- Graph node types (`CUSTOMER`, `ORDER`, `PRODUCT`, `SEGMENT`) and edge types (`PLACED`, `CONTAINS`, `BELONGS_TO`, `REPEATEDLY_PURCHASED`, `RELATED_TO`).
- `BigDecimal` behavioral analytics formulas, deterministic segmentation rules, and product co-purchase calculations.
