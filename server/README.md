# ORDEXA Backend Server (`ordexa-server`) — Milestone 2

Production-grade Spring Boot 3.4.3 modular monolith implementing multi-tenant authentication, merchant workspaces, role-based access control (RBAC), rotated refresh tokens, and PostgreSQL persistence.

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
├── tenant/
│   ├── context/ (TenantContext, TenantContextHolder)
│   ├── filter/JwtAuthenticationFilter.java
│   └── security/TenantAuthorizationService.java
├── config/ (SecurityConfig, CorsConfig, CorsProperties, OpenApiConfig, ApplicationConfig)
├── common/ (ApiResponse, PagedResponse, GlobalExceptionHandler, ErrorCode, OrdexaException, CorrelationIdFilter)
└── health/ (HealthController, HealthCheckService, HealthResponse, SystemBootstrapRecord)
```

---

## 2. Security & Multi-Tenant Enforcement

1. **Password Security:**
   - Passwords are validated against `PasswordPolicyValidator` (8–128 chars, uppercase, lowercase, digit, special symbol) and hashed using `BCryptPasswordEncoder(10)`. Plaintext passwords are never stored or logged.
2. **Short-Lived JWT Access Tokens + Database Session Verification:**
   - Signed with HMAC-SHA256 (`JJWT 0.12.6`) using a minimum 256-bit key (`JWT_SECRET`).
   - Default TTL: `900` seconds (15 minutes).
   - Every authenticated request in `JwtAuthenticationFilter` verifies the JWT signature, issuer, expiration, token type (`ACCESS`), AND checks that the referenced `AuthenticationSession` (`sid`) is still `ACTIVE` in PostgreSQL. As a result, **logging out or triggering refresh replay immediately invalidates in-flight access tokens**.
3. **Refresh-Token Rotation & Replay Detection:**
   - Raw 256-bit cryptographically random refresh tokens are sent to the browser via an `HttpOnly` cookie (`ordexa_refresh_token`, path `/api/v1/auth`).
   - Only the SHA-256 hex digest (`token_hash`) is persisted in `refresh_tokens`.
   - Calling `POST /api/v1/auth/refresh` revokes the used token (`replaced_by_token_id`) and issues a new token.
   - If a previously rotated refresh token is ever presented again, `AuthenticationService` detects the replay, immediately revokes the entire `AuthenticationSession` and all tokens in that session family, writes a `REFRESH_TOKEN_REPLAY_DETECTED` entry to `audit_logs`, and returns `401 REFRESH_TOKEN_REPLAY`.
4. **Multi-Tenant Isolation (`TenantContextHolder` & `TenantAuthorizationService`):**
   - `TenantContext` is resolved exclusively from the verified JWT + live PostgreSQL `MerchantMembership` lookup—never from client headers or request body merchant IDs alone.
   - `TenantContextHolder.requireMerchantMatch(merchantId)` and `@PreAuthorize("@tenantAuth.hasAccessToMerchant(#merchantId, '...')")` reject any attempt by Tenant A to read or mutate Tenant B's resources with `403 TENANT_ACCESS_DENIED` and log `CROSS_TENANT_ACCESS_BLOCKED`.
   - `TenantContextHolder.clear()` runs in a `finally` block on every HTTP request so pooled threads never retain tenant state.

---

## 3. Build, Test & Run Commands

```powershell
# Run full compilation, unit tests, MockMvc integration tests, and live PostgreSQL verification
.\mvnw.cmd clean verify

# Start Spring Boot backend on port 8080
.\mvnw.cmd spring-boot:run
```
