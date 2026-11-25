# ORDEXA — Supabase Cloud PostgreSQL Setup Guide

ORDEXA uses **Supabase** as managed PostgreSQL infrastructure over JDBC (Shared Pooler — Session Mode, SSL required), while preserving Spring Boot 3.4.x, Spring Data JPA, Hibernate (`ddl-auto: validate`), Flyway migrations, and JWT multi-tenant authentication.

---

## 1. Connection Architecture

- **Provider**: Supabase Cloud PostgreSQL
- **Connection Mode**: Shared Pooler (Session Mode, port `5432`)
- **Transport**: JDBC with mandatory SSL (`sslmode=require`)
- **Spring Profile**: `supabase` ([application-supabase.yml](file:///c:/Users/MANIK%20MEHRA/ordexa/server/src/main/resources/application-supabase.yml))

---

## 2. Environment Variables

Copy `.env.example` to `.env` (already gitignored) or set these environment variables in your shell:

```env
SPRING_PROFILES_ACTIVE=supabase

SUPABASE_DB_HOST=aws-1-ap-southeast-2.pooler.supabase.com
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USERNAME=postgres.cumzjxsxjxvhhldsjluj
SUPABASE_DB_PASSWORD=<enter-your-supabase-db-password-locally>
```

Alternatively, you can override the full Spring DataSource directly:

```env
SPRING_DATASOURCE_URL=jdbc:postgresql://aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require
SPRING_DATASOURCE_USERNAME=postgres.cumzjxsxjxvhhldsjluj
SPRING_DATASOURCE_PASSWORD=<enter-your-supabase-db-password-locally>
```

> [!IMPORTANT]
> - Never commit `.env` or paste real database passwords into any tracked file.
> - Never place database credentials into `VITE_*` variables. Only the Spring Boot backend connects to PostgreSQL.

---

## 3. Switching Between Local PostgreSQL and Supabase

| Mode | `SPRING_PROFILES_ACTIVE` | Target Database |
| :--- | :--- | :--- |
| **Local PostgreSQL** | `local` (default) | `127.0.0.1:5433/ordexa_db` |
| **Supabase Cloud** | `supabase` | `aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres` (SSL) |
| **Docker Compose** | `docker` | `postgres:5432/ordexa_db` |
| **Automated Tests** | `test` | H2 in-memory (`MODE=PostgreSQL`) |

---

## 4. Running the Backend Against Supabase

In PowerShell:

```powershell
cd server
$env:SPRING_PROFILES_ACTIVE = "supabase"
$env:SUPABASE_DB_PASSWORD = Read-Host "Enter Supabase DB Password" -AsSecureString | ForEach-Object { [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($_)) }
.\mvnw.cmd spring-boot:run -B
```

### How Flyway Initializes the Cloud Database
On first startup against an empty Supabase database:
1. `DatabaseConfigValidator` verifies that `SUPABASE_DB_PASSWORD` (or `SPRING_DATASOURCE_PASSWORD`) is non-empty before HikariCP connects.
2. Flyway executes `V1` through `V4` from `classpath:db/migration` in order and records them in `flyway_schema_history`.
3. Hibernate (`ddl-auto: validate`) verifies every JPA entity matches the migrated schema.

---

## 5. Teammate Onboarding

1. Pull the latest repository (`git pull origin main`).
2. Copy `.env.example` to `.env`.
3. Set `SPRING_PROFILES_ACTIVE=supabase` and paste the shared Supabase database password into `SUPABASE_DB_PASSWORD` in your local `.env` (never commit `.env`).
4. Start the backend (`.\mvnw.cmd spring-boot:run`) and frontend (`npm run dev`).

---

## 6. Security Precautions

- Always use `sslmode=require` (enforced automatically by `application-supabase.yml`).
- Never log `SUPABASE_DB_PASSWORD`, `SPRING_DATASOURCE_PASSWORD`, or JDBC URLs with embedded credentials.
- Multi-tenant isolation (`merchant_id` scoping via `TenantContextHolder`) and JWT authentication remain enforced by Spring Security on every API request.

---

## 7. Verification & Health Check

Verify backend health and database connectivity:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8080/actuator/health"
```

Expected response: `{"status":"UP","groups":["liveness","readiness"]}`

---

## 8. Troubleshooting

| Symptom | Cause | Resolution |
| :--- | :--- | :--- |
| `Database password is missing for active profile(s) [supabase]` | `SUPABASE_DB_PASSWORD` / `SPRING_DATASOURCE_PASSWORD` is empty | Export `SUPABASE_DB_PASSWORD` in your shell or `.env`. |
| `password authentication failed for user` | Incorrect password or mismatched Supabase project ref username | Verify `SUPABASE_DB_USERNAME` matches `postgres.<project-ref>` in Supabase Dashboard → Settings → Database. |
| `Max client connections reached` | Pool size too high for Supabase Session Pooler | Keep `DB_MAX_POOL_SIZE=5` (default in `application-supabase.yml`). |

---

## 9. Backup & Recovery

- **Supabase Automated Backups**: Managed via Supabase Dashboard → Database → Backups.
- **Manual Logical Backup**: Run `pg_dump -h aws-1-ap-southeast-2.pooler.supabase.com -p 5432 -U postgres.<project-ref> -d postgres -Fc -f ordexa_supabase_backup.dump` (keep dumps out of Git).
