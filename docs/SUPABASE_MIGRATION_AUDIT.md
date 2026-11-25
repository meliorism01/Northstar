# ORDEXA — Supabase Cloud PostgreSQL Migration Audit

**Date:** 2026-11-25  
**Scope:** Pre-migration architectural, configuration, schema, security, and risk audit for migrating ORDEXA from local PostgreSQL to Supabase Cloud PostgreSQL (Shared Pooler — Session Mode).

---

## 1. Current Backend & Database Architecture

| Component | Current Version / Configuration | Source File |
| :--- | :--- | :--- |
| **Java Runtime** | OpenJDK `17.0.20.1` (`<java.version>17</java.version>`, optional `java21` profile) | [pom.xml](file:///c:/Users/MANIK%20MEHRA/ordexa/server/pom.xml) |
| **Spring Boot** | `3.4.3` (`spring-boot-starter-parent`) | [pom.xml](file:///c:/Users/MANIK%20MEHRA/ordexa/server/pom.xml) |
| **ORM / Persistence** | Spring Data JPA + Hibernate (`ddl-auto: validate`, `open-in-view: false`, UTC JDBC timezone) | [application.yml](file:///c:/Users/MANIK%20MEHRA/ordexa/server/src/main/resources/application.yml) |
| **Connection Pool** | HikariCP (`OrdexaHikariPool`, `maximum-pool-size: 10`, `minimum-idle: 2`) | [application.yml](file:///c:/Users/MANIK%20MEHRA/ordexa/server/src/main/resources/application.yml) |
| **Schema Migration** | Flyway (`flyway-core`, `flyway-database-postgresql`, `validate-on-migrate: true`, `baseline-on-migrate: false`) | [application.yml](file:///c:/Users/MANIK%20MEHRA/ordexa/server/src/main/resources/application.yml) |
| **Active Local Database** | PostgreSQL `18.6` cluster in `.pgdata/` on `127.0.0.1:5433`, database `ordexa_db`, user `ordexa_app` | [application-local.yml](file:///c:/Users/MANIK%20MEHRA/ordexa/server/src/main/resources/application-local.yml) |
| **Docker Database** | `postgres:16-alpine` on port `5432` (when started via Compose) | [docker-compose.yml](file:///c:/Users/MANIK%20MEHRA/ordexa/docker-compose.yml) |
| **Frontend API Proxy** | Vite proxies `/api` to `http://127.0.0.1:8080`; `apiClient.js` uses `VITE_API_BASE_URL` or `/api/v1` | [vite.config.js](file:///c:/Users/MANIK%20MEHRA/ordexa/vite.config.js) |

---

## 2. Spring Profiles & Configuration Findings

1. **Multiple Spring Profiles Exist**:
   - `local` (default active profile in `application.yml`)
   - `docker` (`application-docker.yml`, connects to `postgres:5432`)
   - `prod` (`application-prod.yml`, requires `DB_HOST`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`)
   - `test` (`application-test.yml`, uses H2 in-memory `MODE=PostgreSQL` for unit/MockMvc tests)
2. **DataSource URL Construction Gap**:
   - Currently `application.yml`, `application-local.yml`, `application-docker.yml`, and `application-prod.yml` construct the JDBC URL exclusively from `DB_HOST`, `DB_PORT`, `DB_NAME` without SSL parameters (`sslmode=require`) and without supporting direct `SPRING_DATASOURCE_URL` / `SPRING_DATASOURCE_USERNAME` / `SPRING_DATASOURCE_PASSWORD` or `SUPABASE_DB_*` overrides.
3. **Hardcoded Local Defaults**:
   - `application-local.yml` defaults `DB_HOST=127.0.0.1`, `DB_PORT=5433`, `DB_NAME=ordexa_db`, `DB_USERNAME=ordexa_app`, `DB_PASSWORD=change_me_local_dev_password_only`.
   - `LivePostgresMultiTenantIntegrationTest.java` hardcodes `jdbc:postgresql://127.0.0.1:5433/ordexa_test_db` for an optional live-DB integration test.
4. **Credential Exposure Audit**:
   - `git grep` confirms **no real cloud/production credentials** are committed in tracked files.
   - `.env` and `server/.env` are already excluded in `.gitignore` (no `.env` file currently exists on disk).
   - No database credentials are exposed to the React/Vite frontend (`VITE_*` only contains `VITE_API_BASE_URL`).

---

## 3. Existing Flyway Migrations & Local Database State

All 4 Flyway migrations in `server/src/main/resources/db/migration/` use standard PostgreSQL DDL in the `public` schema with no superuser extensions (`CREATE EXTENSION` is not used), making them 100% compatible with Supabase's managed PostgreSQL `postgres` role.

| Version | Script | Installed On (Local) | Status |
| :--- | :--- | :--- | :--- |
| `1` | `V1__init_foundation_metadata.sql` | `2026-11-25 12:14:03` | Success |
| `2` | `V2__init_merchants_users_and_memberships.sql` | `2026-11-25 12:14:03` | Success |
| `3` | `V3__init_customers_orders_and_history.sql` | `2026-11-25 13:15:52` | Success |
| `4` | `V4__customer_intelligence.sql` | `2026-11-25 16:42:35` | Success |

### Existing Local Tables & Record Counts (`127.0.0.1:5433/ordexa_db`)

| Table | Row Count | Category |
| :--- | :---: | :--- |
| `merchants` | 32 | Tenant / Workspace |
| `users` | 33 | Identity |
| `merchant_memberships` | 38 | RBAC & Tenant Mapping |
| `authentication_sessions` | 40 | Auth Sessions |
| `refresh_tokens` | 48 | JWT Refresh Rotation |
| `audit_logs` | 195 | Security Audit Trail |
| `system_bootstrap_audit` | 1 | Bootstrap Metadata |
| `customers` | 20 | Commerce Customers |
| `orders` | 37 | Commerce Orders |
| `order_items` | 57 | Order Line Items |
| `order_status_history` | 103 | Order Lifecycle History |
| `customer_behavioural_events` | 35 | Intelligence Events |
| `flyway_schema_history` | 4 | Flyway Metadata |

---

## 4. Risks & Mitigation Strategy

| Risk | Severity | Mitigation |
| :--- | :---: | :--- |
| **SSL Enforcement on Supabase** | High | Require `sslmode=require` on all Supabase JDBC URLs (`application-supabase.yml` / `DB_SSL_MODE=require`). |
| **Session Pooler Connection Limits** | Medium | Use HikariCP conservative pool sizing (`maximum-pool-size: 5`, `minimum-idle: 1`) on Supabase Session Pooler (`port 5432`) to avoid exhausting Supavisor session slots. |
| **Missing Password / Silent Fallback** | High | Fail fast with a clear configuration error if `DB_PASSWORD` / `SPRING_DATASOURCE_PASSWORD` is missing when `supabase` or `prod` profile is active. Never fall back to local defaults in cloud profiles. |
| **Credential Leakage in Git / Logs** | Critical | Keep `.env` gitignored; never log JDBC URLs with embedded credentials or env var values; leave passwords blank in `.env.example`. |
| **Flyway Checksum / Dirty Schema** | High | Inspect Supabase `public` schema before running Flyway; keep `ddl-auto: validate` and `baseline-on-migrate: false`; never modify `V1`–`V4`. |
| **Overwriting Local Data** | High | Keep `.pgdata/` untouched; document backup (`pg_dump`) and safe ordered data migration before executing any data copy. |

---

## 5. Files Requiring Creation or Modification

- **New Profile**: `server/src/main/resources/application-supabase.yml` — dedicated Supabase Session Pooler profile (`sslmode=require`, Hikari pool tuning, `ddl-auto: validate`, fail-fast missing credentials).
- **Root Config**: `server/src/main/resources/application.yml` — support `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD` seamlessly alongside `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USERNAME`/`DB_PASSWORD`.
- **Environment Template**: `.env.example` — document both Local PostgreSQL and Supabase Cloud PostgreSQL environment variables with empty password placeholders.
- **Documentation**:
  - `docs/SUPABASE_MIGRATION_AUDIT.md` (this document)
  - `docs/LOCAL_TO_SUPABASE_DATA_MIGRATION.md`
  - `docs/SUPABASE_SETUP.md`
  - `README.md` (concise database setup section)

---

## 6. Safe Migration Plan

1. **Configure Environment-Based Connectivity**: Add `application-supabase.yml` and update `application.yml` + `.env.example` while preserving `local`, `docker`, and `test` profiles intact.
2. **Verify Empty Cloud Database**: Connect to Supabase PostgreSQL via JDBC/SSL (using local env credentials, never committed) and verify `public` schema has no conflicting ORDEXA tables or `flyway_schema_history`.
3. **Initialize Cloud Schema via Flyway**: Run Spring Boot / Flyway against Supabase with `ddl-auto: validate` to apply `V1`–`V4` cleanly.
4. **Validate Schema & Health**: Confirm Hibernate `validate`, `/actuator/health`, and core API endpoints against Supabase.
5. **Preserve Local Data**: Document backup and ordered data migration in `docs/LOCAL_TO_SUPABASE_DATA_MIGRATION.md` and pause for explicit approval before migrating local rows.
6. **Regression Test**: Run full automated test suite (`mvnw.cmd test`) and verify production frontend build (`npm run build`).
