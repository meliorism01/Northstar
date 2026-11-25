# ORDEXA Backend Server (`ordexa-server`) — Milestones 2 & 3

Production-grade Spring Boot 3.4.3 modular monolith implementing multi-tenant authentication, merchant workspaces, role-based access control (RBAC), rotated refresh tokens, database-backed Order & Customer Management, controlled order lifecycle transitions, CSV order importing, and PostgreSQL persistence.

---

## 1. Module & Package Structure

```text
com.ordexa
├── OrdexaApplication.java
├── auth/
│   ├── controller/AuthController.java
│   ├── dto/ (RegisterRequest, RegisterResponse, LoginRequest, SelectWorkspaceRequest, AuthSessionResponse, WorkspacesResponse)
│   ├── entity/ (AuthenticationSession, SessionStatus, RefreshToken, AuditLog)
│   ├── security/ (JwtProperties, JwtTokenService, JwtClaimsPrincipal, PasswordPolicyValidator, AuthRateLimitFilter)
│   ├── service/AuthenticationService.java
│   └── token/ (AuthenticationSessionRepository, RefreshTokenRepository, AuditLogRepository, TokenHashUtil)
├── merchant/
│   ├── controller/MerchantWorkspaceController.java
│   ├── dto/ (MerchantWorkspaceDetailDto, UpdateMerchantRequest, AddWorkspaceMemberRequest)
│   ├── entity/ (Merchant, MerchantStatus)
│   ├── repository/MerchantRepository.java
│   └── service/MerchantWorkspaceService.java
├── user/
│   ├── controller/UserController.java
│   ├── dto/UserProfileDto.java
│   ├── entity/ (User, UserStatus)
│   ├── repository/UserRepository.java
│   └── service/UserService.java
├── membership/
│   ├── dto/ (WorkspaceSummaryDto, MemberSummaryDto)
│   ├── entity/ (MerchantMembership, MerchantRole, MembershipStatus)
│   ├── repository/MerchantMembershipRepository.java
│   └── service/MembershipService.java
├── customer/
│   ├── controller/CustomerController.java
│   ├── dto/ (CustomerSummaryDto, CustomerDetailDto)
│   ├── entity/Customer.java
│   ├── repository/CustomerRepository.java
│   └── service/CustomerService.java
├── order/
│   ├── controller/OrderController.java
│   ├── dto/ (CreateOrderRequest, UpdateOrderRequest, UpdateOrderStatusRequest, OrderItemRequest, OrderItemDto, OrderStatusHistoryDto, OrderSummaryDto, OrderDetailDto, CsvImportOrdersRequest, CsvRowErrorDto, CsvImportSummaryDto)
│   ├── entity/ (Order, OrderItem, OrderStatusHistory, OrderSource, OrderStatus, PaymentStatus, PaymentMethod)
│   ├── repository/ (OrderRepository, OrderItemRepository, OrderStatusHistoryRepository)
│   └── service/ (OrderService, CsvOrderImportService)
├── tenant/
│   ├── context/ (TenantContext, TenantContextHolder)
│   ├── filter/JwtAuthenticationFilter.java
│   └── security/TenantAuthorizationService.java
├── config/ (SecurityConfig, CorsConfig, CorsProperties, OpenApiConfig, ApplicationConfig)
├── common/ (ApiResponse, PagedResponse, GlobalExceptionHandler, ErrorCode, OrdexaException, CorrelationIdFilter)
└── health/ (HealthController, HealthCheckService, HealthResponse, SystemBootstrapRecord)
```

---

## 2. Security, Multi-Tenant Enforcement & Order Management Rules

1. **Strict Tenant Scoping (`TenantContextHolder`):**
   - Every query in `OrderRepository`, `CustomerRepository`, `OrderItemRepository`, and `OrderStatusHistoryRepository` requires `merchantId` derived from `TenantContextHolder.requireActiveWorkspace()`.
   - `merchant_id` is never accepted from request bodies or query parameters for order/customer operations.
   - Cross-tenant order or customer ID access returns `404 RESOURCE_NOT_FOUND` without leaking resource existence across merchants.
2. **Merchant-Scoped Customer Identity:**
   - Customers are uniquely keyed per merchant by `(merchant_id, phone_number)` via `CustomerService.normalizePhoneNumber(...)`.
   - Two different merchants can independently store a customer with the same phone number (`+919876543210`) without any cross-merchant collision or data sharing.
3. **Server-Side `BigDecimal` Monetary Arithmetic:**
   - All monetary values (`unitPrice`, `totalPrice`, `subtotal`, `discount`, `shippingFee`, `totalAmount`) use `BigDecimal` (`NUMERIC(14,2)`) with `RoundingMode.HALF_UP`.
   - Client-submitted totals are never trusted; `OrderService` computes line item totals and `totalAmount = subtotal - discount + shippingFee` on the server and rejects negative totals (`discount > subtotal + shippingFee`).
4. **Controlled Order Lifecycle & Optimistic Locking:**
   - `OrderStatus.canTransitionTo(target)` enforces `CREATED -> CONFIRMED -> PROCESSING -> SHIPPED -> DELIVERED` and cancellation from `CREATED`, `CONFIRMED`, or `PROCESSING`.
   - `Order` includes `@Version Long version` (`BIGINT`) so concurrent status transitions produce `409 CONCURRENT_MODIFICATION` rather than corrupting state.
   - Every creation and transition appends an immutable row to `order_status_history` with `previous_status`, `new_status`, `changed_by_user_id`, `reason`, and `created_at`.

---

## 3. Build, Test & Run Commands

```powershell
# Run full compilation, unit tests, MockMvc integration tests, and live PostgreSQL verification
.\mvnw.cmd test -B

# Start Spring Boot backend on port 8080
.\mvnw.cmd spring-boot:run
```
