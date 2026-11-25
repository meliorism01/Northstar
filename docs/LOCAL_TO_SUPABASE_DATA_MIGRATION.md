# ORDEXA — Local PostgreSQL to Supabase Data Migration Guide

This document defines the safe, auditable procedure for migrating existing ORDEXA development data from the local PostgreSQL cluster (`127.0.0.1:5433/ordexa_db`) to Supabase Cloud PostgreSQL (`aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres`).

> [!CAUTION]
> **Do NOT run data migration until:**
> 1. A verified backup of the local database exists.
> 2. Flyway migrations (`V1`–`V4`) have initialized the Supabase schema cleanly (`ddl-auto: validate` passing).
> 3. The destination Supabase business tables are confirmed empty.

---

## 1. Back Up the Local Database

Create a timestamped backup directory (excluded from Git via `.gitignore`) and take both a custom-format archive and a plain SQL snapshot:

```powershell
New-Item -ItemType Directory -Force -Path backups | Out-Null
$ts = Get-Date -Format "yyyyMMdd_HHmmss"

# Full custom-format backup (schema + data)
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" `
  -h 127.0.0.1 -p 5433 -U ordexa_app -d ordexa_db `
  -Fc -f "backups\ordexa_local_full_$ts.dump"

# Plain SQL data-only backup (for inspection)
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" `
  -h 127.0.0.1 -p 5433 -U ordexa_app -d ordexa_db `
  --data-only --column-inserts --no-owner --no-privileges `
  -f "backups\ordexa_local_data_$ts.sql"
```

Verify the backup file is non-empty before proceeding.

---

## 2. Inspect Source and Destination Schemas

### Source (Local PostgreSQL)
```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" `
  -h 127.0.0.1 -p 5433 -U ordexa_app -d ordexa_db `
  -c "SELECT version, script, success FROM flyway_schema_history ORDER BY installed_rank;"
```

### Destination (Supabase Cloud PostgreSQL)
Set `$env:PGPASSWORD` in your current PowerShell session only (never commit it), then verify Flyway history and confirm all 12 business tables have `0` rows:

```powershell
$env:PGSSLMODE = "require"
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" `
  -h aws-1-ap-southeast-2.pooler.supabase.com -p 5432 `
  -U postgres.cumzjxsxjxvhhldsjluj -d postgres `
  -c "SELECT version, script, success FROM flyway_schema_history ORDER BY installed_rank;"
```

---

## 3. Export Existing Data (Preserving Foreign Keys & Primary Keys)

To avoid foreign-key violations and avoid overwriting `flyway_schema_history`, export **only** the 12 business tables in topological parent-before-child order:

1. `system_bootstrap_audit`
2. `merchants`
3. `users`
4. `merchant_memberships`
5. `authentication_sessions`
6. `refresh_tokens`
7. `audit_logs`
8. `customers`
9. `orders`
10. `order_items`
11. `order_status_history`
12. `customer_behavioural_events`

```powershell
$tables = @(
  "system_bootstrap_audit",
  "merchants",
  "users",
  "merchant_memberships",
  "authentication_sessions",
  "refresh_tokens",
  "audit_logs",
  "customers",
  "orders",
  "order_items",
  "order_status_history",
  "customer_behavioural_events"
)

$tableArgs = $tables | ForEach-Object { "--table=public.$_" }
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" `
  -h 127.0.0.1 -p 5433 -U ordexa_app -d ordexa_db `
  --data-only --column-inserts --no-owner --no-privileges `
  @tableArgs -f "backups\ordexa_ordered_data.sql"
```

---

## 4. Import Data & Preserve Timestamps

All timestamps in ORDEXA (`created_at`, `updated_at`, `order_date`, `occurred_at`, `expires_at`) are stored as `TIMESTAMPTZ` in UTC. Run `psql` with `ON_ERROR_STOP=1` inside a single transaction (`--single-transaction`) so any error aborts cleanly without partial writes:

```powershell
$env:PGSSLMODE = "require"
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" `
  -h aws-1-ap-southeast-2.pooler.supabase.com -p 5432 `
  -U postgres.cumzjxsxjxvhhldsjluj -d postgres `
  -v ON_ERROR_STOP=1 --single-transaction `
  -f "backups\ordexa_ordered_data.sql"
```

> [!NOTE]
> `system_bootstrap_audit` already receives 1 seed row from `V1__init_foundation_metadata.sql`. If migrating `system_bootstrap_audit` into an already-initialized Supabase DB, omit `system_bootstrap_audit` from the export list or use `ON CONFLICT DO NOTHING`.

---

## 5. Handle PostgreSQL Sequences

ORDEXA uses `UUID` primary keys on business entities (`merchants`, `users`, `customers`, `orders`, etc.) and `BIGSERIAL`/`IDENTITY` on audit/bootstrap tables (`system_bootstrap_audit`). Reset any sequences after data import to prevent primary key collisions on future inserts:

```sql
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT seq.relname AS seq_name, tbl.relname AS tbl_name, col.attname AS col_name
        FROM pg_class seq
        JOIN pg_depend d ON d.objid = seq.oid AND d.deptype = 'a'
        JOIN pg_class tbl ON tbl.oid = d.refobjid
        JOIN pg_attribute col ON col.attrelid = tbl.oid AND col.attnum = d.refobjsubid
        WHERE seq.relkind = 'S'
    LOOP
        EXECUTE format(
            'SELECT setval(%L, COALESCE((SELECT MAX(%I) FROM %I), 1), true)',
            r.seq_name, r.col_name, r.tbl_name
        );
    END LOOP;
END $$;
```

---

## 6. Validate Record Counts

Run this exact count query against **both** local PostgreSQL and Supabase PostgreSQL and verify all 12 counts match:

```sql
SELECT 'merchants' AS tbl, COUNT(*) FROM merchants
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'merchant_memberships', COUNT(*) FROM merchant_memberships
UNION ALL SELECT 'authentication_sessions', COUNT(*) FROM authentication_sessions
UNION ALL SELECT 'refresh_tokens', COUNT(*) FROM refresh_tokens
UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs
UNION ALL SELECT 'system_bootstrap_audit', COUNT(*) FROM system_bootstrap_audit
UNION ALL SELECT 'customers', COUNT(*) FROM customers
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL SELECT 'order_status_history', COUNT(*) FROM order_status_history
UNION ALL SELECT 'customer_behavioural_events', COUNT(*) FROM customer_behavioural_events;
```

---

## 7. Rollback Procedure

- **If import fails mid-run**: `--single-transaction` rolls back automatically, leaving Supabase empty.
- **If post-import validation fails**: Clear business tables on Supabase while keeping `flyway_schema_history` intact:
  ```sql
  TRUNCATE TABLE
    customer_behavioural_events, order_status_history, order_items, orders,
    customers, audit_logs, refresh_tokens, authentication_sessions,
    merchant_memberships, users, merchants
  RESTART IDENTITY CASCADE;
  ```
- **Local database**: Remains completely untouched in `.pgdata/` and backed up in `backups\ordexa_local_full_*.dump`.
