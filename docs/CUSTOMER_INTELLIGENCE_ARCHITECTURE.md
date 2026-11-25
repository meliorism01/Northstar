# NORTHSTAR — Customer Intelligence Graph Architecture Reference (Milestone 4)

## 1. Architectural Overview & Storage Decision

The **NORTHSTAR Customer Intelligence Graph** transforms merchant-scoped transactional records (`customers`, `orders`, `order_items`, `order_status_history`, and `customer_behavioural_events`) into a behavioral intelligence, explainable segmentation, product co-purchase, and relationship graph engine.

### Why PostgreSQL Instead of Neo4j / External Graph Databases
- **Single Source of Transactional Truth:** All customer, order, line item, and status transition entities reside in PostgreSQL 18 (`V1`–`V4` Flyway migrations). Computing graph topologies and behavioral metrics directly from PostgreSQL guarantees immediate ACID consistency when an order is created, updated, or transitioned.
- **Bounded Merchant Neighborhoods:** Graph queries in NORTHSTAR are strictly scoped to a single authenticated merchant workspace (`merchant_id`) and bounded by explicit node limits (`limit`, default `120`, max `500`), requiring at most 1–2 relational hops (`Customer -> Order -> OrderItem/Product` and `Customer -> Shared Product -> Customer`).
- **Zero Operational Synchronization Drift:** Avoiding an external Neo4j, Redis, or Kafka pipeline eliminates dual-write anomalies and keeps the modular monolith simple, auditable, and fast.

---

## 2. Database Schema & Indexing (`V4__customer_intelligence.sql`)

### `customer_behavioural_events`
Stores explicit customer-level milestones that complement `order_status_history` without duplicating order lifecycle rows:
- `id UUID PRIMARY KEY`
- `merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE`
- `customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE`
- `order_id UUID REFERENCES orders(id) ON DELETE SET NULL`
- `event_type VARCHAR(48) NOT NULL` (`CUSTOMER_CREATED`, `CUSTOMER_PROFILE_UPDATED`, `REPEAT_PURCHASE`, `PAYMENT_COMPLETED`)
- `title VARCHAR(160) NOT NULL`
- `description VARCHAR(512)`
- `occurred_at TIMESTAMP WITH TIME ZONE NOT NULL`

### Targeted Aggregation Indexes Added in V4
- `idx_cbe_merchant_customer_time ON customer_behavioural_events (merchant_id, customer_id, occurred_at DESC)`
- `idx_cbe_merchant_type ON customer_behavioural_events (merchant_id, event_type)`
- `idx_order_items_merchant_sku ON order_items (merchant_id, sku)`
- `idx_order_items_merchant_order_sku ON order_items (merchant_id, order_id, sku)`
- `idx_orders_merchant_customer_status_created ON orders (merchant_id, customer_id, order_status, created_at DESC)`

---

## 3. Graph Data Model: Nodes & Edges

### 3.1 Graph Node Types (`GraphNodeType`)

| Node Type | ID Format | Key Attributes (`metrics`) |
| :--- | :--- | :--- |
| `CUSTOMER` | `customer:<UUID>` | `customerId`, `name`, `phoneNumber`, `totalOrders`, `totalSpend`, `averageOrderValue`, `customerSegment`, `segments`, `lastOrderAt` |
| `ORDER` | `order:<UUID>` | `orderId`, `orderNumber`, `totalAmount`, `orderStatus`, `paymentMethod`, `createdAt` |
| `PRODUCT` | `product:<SKU>` | `productName`, `sku`, `unitsPurchased`, `totalRevenue`, `uniqueCustomers` |
| `SEGMENT` | `segment:<SEGMENT_ID>` | `segmentId`, `segmentName`, `description`, `customerCount` |

### 3.2 Graph Edge Types (`GraphEdgeType`)

| Edge Type | Source -> Target | Semantic Meaning & Metadata |
| :--- | :--- | :--- |
| `PLACED` | `CUSTOMER -> ORDER` | Customer placed the order (`orderStatus`, `totalAmount`) |
| `CONTAINS` | `ORDER -> PRODUCT` | Order contains line item for normalized SKU (`quantity`, `totalPrice`) |
| `BELONGS_TO` | `CUSTOMER -> SEGMENT` | Customer satisfies deterministic segment rule (`reason`, `threshold`) |
| `REPEATEDLY_PURCHASED` | `CUSTOMER -> PRODUCT` | Customer purchased SKU across `>= 2` non-cancelled orders or `>= 2` units (`ordersCount`, `unitsPurchased`) |
| `RELATED_TO` | `CUSTOMER -> CUSTOMER` | Strictly defined as `SHARED_PRODUCT_PURCHASE`: two customers within the same merchant workspace independently purchased at least one overlapping non-cancelled SKU (`sharedSkus`, `sharedProductCount`, `explanation`). Never implies a personal or real-world relationship. |

### 3.3 Individual Customer Graph Endpoint (`GET /api/v1/intelligence/customers/{customerId}/graph`)
The primary frontend graph workspace follows a **customer-first exploration model** (1 selected customer at a time):
- Returns strictly 1 central `CUSTOMER` node (`customer:<customerId>`), their `ORDER` nodes, consolidated `PRODUCT` nodes purchased across those orders (with customer-specific `unitsPurchased`), and their assigned `SEGMENT` nodes.
- Uses `PLACED`, `CONTAINS`, and `BELONGS_TO` edges and never mixes in unrelated customers, orders, or products.

---

## 4. Customer Metrics & Mathematical Formulas

All monetary values and percentages are calculated in `CustomerIntelligenceCalculator` using `java.math.BigDecimal` with scale `2` and `RoundingMode.HALF_UP`:

1. **Order Counts:**
   - `totalOrders`: Count of all recorded orders for the customer (including `CANCELLED`).
   - `nonCancelledOrders`: Count of orders where `orderStatus != CANCELLED`.
   - `deliveredOrders`: Count of orders where `orderStatus == DELIVERED`.
   - `cancelledOrders`: Count of orders where `orderStatus == CANCELLED`.
   - `pendingOrders`: Count of orders in `CREATED`, `CONFIRMED`, `PROCESSING`, or `SHIPPED`.
2. **Monetary Metrics:**
   - `totalSpend` (and `customerLifetimeValue`): Sum of `total_amount` across all **non-cancelled** (`qualifying`) orders.
   - `grossOrderValueIncludingCancelled`: Sum of `total_amount` across all recorded orders.
   - `averageOrderValue (AOV)`:
     $$\text{AOV} = \begin{cases} \frac{\text{totalSpend}}{\text{nonCancelledOrders}} & \text{if } \text{nonCancelledOrders} > 0 \\ 0.00 & \text{otherwise} \end{cases}$$
3. **Frequency & Recency Metrics:**
   - `repeatPurchaseCount`: $\max(0, \text{totalOrders} - 1)$.
   - `daysSinceLastOrder`: $\lfloor \text{Duration}(\text{lastOrderAt}, \text{now})_{\text{days}} \rfloor$.
   - `daysSinceLastQualifyingOrder`: Days elapsed since the most recent non-cancelled order (`lastQualifyingOrderAt`), falling back to `daysSinceLastOrder` if all orders were cancelled.
   - `averageDaysBetweenOrders`: For customers with $\text{totalOrders} \ge 2$, $\frac{\text{daysBetween}(\text{firstOrderAt}, \text{lastOrderAt})}{\text{totalOrders} - 1}$.
4. **Payment & Outcome Percentages:**
   - `codPercentage`: $\frac{\text{codOrders}}{\text{totalOrders}} \times 100$.
   - `prepaidPercentage`: $\frac{\text{prepaidOrders}}{\text{totalOrders}} \times 100$ (where `PREPAID`, `UPI`, `CARD`, and `NETBANKING` are grouped as prepaid).
   - `cancellationPercentage`: $\frac{\text{cancelledOrders}}{\text{totalOrders}} \times 100$.
   - **Data Quality Rule:** Cancelled orders are never labeled as Return-to-Origin (RTO) or failed deliveries.

---

## 5. Deterministic & Explainable Segmentation Rules

Configured via `CustomerIntelligenceProperties` (`ordexa.intelligence.*`). A customer may belong to multiple segments simultaneously, and every assignment includes `reason`, `evidence`, `thresholdApplied`, and `calculatedAt`:

| Segment ID | Rule & Default Threshold | Explainable Purpose |
| :--- | :--- | :--- |
| `NEW_CUSTOMER` | `totalOrders == 1` | First-time buyer in the merchant workspace |
| `REPEAT_CUSTOMER` | `totalOrders >= 2` | Returning buyer with 2 or more recorded orders |
| `HIGH_VALUE_CUSTOMER` | `totalSpend > 0` AND `totalSpend >= P75(merchant_spends)` (or `>= 5000.00 INR` when `< 4` positive-spend customers exist) | Merchant-relative top spending tier |
| `INACTIVE_CUSTOMER` | `totalOrders >= 1` AND `daysSinceLastQualifyingOrder > 30` | Customer has not placed a qualifying order in over 30 days |
| `CANCELLATION_PRONE_CUSTOMER` | `totalOrders >= 2` AND `cancelledOrders >= 1` AND `cancellationPercentage >= 50.00%` | High cancellation rate with minimum sample size safeguard (`>= 2` orders) |
| `COD_HEAVY_CUSTOMER` | `totalOrders >= 2` AND `codPercentage >= 70.00%` | Payment preference segment (not a risk or fraud label) |
| `LOYAL_CUSTOMER` | `nonCancelledOrders >= 3` AND `deliveredOrders >= 1` AND `cancellationPercentage <= 20.00%` | Sustained repeat buyer with verified deliveries and low cancellation rate |

---

## 6. Product Intelligence & Co-Purchase Formulas

- **SKU Normalization:** Products are grouped per merchant by `UPPER(TRIM(sku))`. The most recent non-blank `productName` is used as the display label.
- **Co-Purchase Metrics (`GET /api/v1/intelligence/products/co-purchases`):**
  - `coPurchaseOrderCount`: Number of distinct non-cancelled orders containing both `skuA` and `skuB`.
  - `sharedCustomerCount`: Number of distinct customers in the merchant workspace who have purchased both `skuA` and `skuB` (either in the same order or across separate orders).
  - `orderSupportPercentage`: $\frac{\text{coPurchaseOrderCount}}{\text{totalQualifyingMerchantOrders}} \times 100$.
  - `customerOverlapPercentage`: Jaccard customer overlap $\frac{|\text{Buyers}(A) \cap \text{Buyers}(B)|}{|\text{Buyers}(A) \cup \text{Buyers}(B)|} \times 100$.

---

## 7. Multi-Tenant Security, Performance & Known Limitations

- **Strict Tenant Isolation:** Every service method in `CustomerIntelligenceService` derives `merchantId` from `TenantContextHolder.requireActiveWorkspace()`. Cross-merchant queries for `customerId`, `sku`, or `graph` return `404 RESOURCE_NOT_FOUND`.
- **Zero N+1 Queries:** `CustomerIntelligenceService` batch-loads the merchant's customers, orders (`JOIN FETCH customer`), and order items (`JOIN FETCH order, customer`) in 3 queries per request.
- **Known Limitations & Future Milestone Integration Points:**
  - Courier NDR and Return-to-Origin (RTO) outcome telemetry are not yet persisted (scheduled for Milestones 5–7); therefore, cancellations are strictly reported as cancellations and never conflated with RTOs.
  - Aggregations run on demand against PostgreSQL; for enterprise merchants exceeding 100,000+ orders per workspace, materialized PostgreSQL views can be introduced behind the same `CustomerIntelligenceService` contract.
