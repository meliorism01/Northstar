-- ============================================================================
-- Migration: V2__init_merchants_users_and_memberships.sql
-- Purpose:   Multi-tenant authentication, merchant workspaces, role-based
--            memberships, session tracking, rotated refresh tokens, and
--            security audit logs.
-- ============================================================================

-- 1. MERCHANTS
CREATE TABLE merchants (
    id            UUID                     PRIMARY KEY,
    business_name VARCHAR(160)             NOT NULL,
    business_slug VARCHAR(160)             NOT NULL,
    status        VARCHAR(32)              NOT NULL DEFAULT 'ACTIVE',
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_merchants_business_slug UNIQUE (business_slug),
    CONSTRAINT chk_merchants_status CHECK (status IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED'))
);

CREATE INDEX idx_merchants_status ON merchants (status);

-- 2. USERS
CREATE TABLE users (
    id            UUID                     PRIMARY KEY,
    full_name     VARCHAR(160)             NOT NULL,
    email         VARCHAR(255)             NOT NULL,
    password_hash VARCHAR(255)             NOT NULL,
    status        VARCHAR(32)              NOT NULL DEFAULT 'ACTIVE',
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT chk_users_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'LOCKED'))
);

CREATE INDEX idx_users_status ON users (status);

-- 3. MERCHANT MEMBERSHIPS
CREATE TABLE merchant_memberships (
    id          UUID                     PRIMARY KEY,
    merchant_id UUID                     NOT NULL,
    user_id     UUID                     NOT NULL,
    role        VARCHAR(32)              NOT NULL,
    status      VARCHAR(32)              NOT NULL DEFAULT 'ACTIVE',
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_memberships_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE,
    CONSTRAINT fk_memberships_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT uq_memberships_merchant_user UNIQUE (merchant_id, user_id),
    CONSTRAINT chk_memberships_role CHECK (role IN ('OWNER', 'ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER')),
    CONSTRAINT chk_memberships_status CHECK (status IN ('ACTIVE', 'INVITED', 'REVOKED'))
);

CREATE INDEX idx_memberships_user_id ON merchant_memberships (user_id);
CREATE INDEX idx_memberships_merchant_id ON merchant_memberships (merchant_id);

-- 4. AUTHENTICATION SESSIONS
CREATE TABLE authentication_sessions (
    id                 UUID                     PRIMARY KEY,
    user_id            UUID                     NOT NULL,
    active_merchant_id UUID,
    status             VARCHAR(32)              NOT NULL DEFAULT 'ACTIVE',
    ip_address         VARCHAR(64),
    user_agent         VARCHAR(512),
    expires_at         TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at         TIMESTAMP WITH TIME ZONE,
    created_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_auth_sessions_merchant FOREIGN KEY (active_merchant_id) REFERENCES merchants (id) ON DELETE SET NULL,
    CONSTRAINT chk_auth_sessions_status CHECK (status IN ('ACTIVE', 'REVOKED', 'EXPIRED'))
);

CREATE INDEX idx_auth_sessions_user_id ON authentication_sessions (user_id);
CREATE INDEX idx_auth_sessions_status ON authentication_sessions (status);

-- 5. REFRESH TOKENS (Stores SHA-256 hashes only; supports rotation & replay detection)
CREATE TABLE refresh_tokens (
    id                   UUID                     PRIMARY KEY,
    user_id              UUID                     NOT NULL,
    token_hash           VARCHAR(128)             NOT NULL,
    session_id           UUID                     NOT NULL,
    expires_at           TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at           TIMESTAMP WITH TIME ZONE,
    created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    replaced_by_token_id UUID,
    CONSTRAINT uq_refresh_tokens_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_refresh_tokens_session FOREIGN KEY (session_id) REFERENCES authentication_sessions (id) ON DELETE CASCADE,
    CONSTRAINT fk_refresh_tokens_replaced_by FOREIGN KEY (replaced_by_token_id) REFERENCES refresh_tokens (id) ON DELETE SET NULL
);

CREATE INDEX idx_refresh_tokens_session_id ON refresh_tokens (session_id);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens (expires_at);

-- 6. SECURITY & TENANT AUDIT LOGS
CREATE TABLE audit_logs (
    id            UUID                     PRIMARY KEY,
    merchant_id   UUID,
    actor_user_id UUID,
    action        VARCHAR(96)              NOT NULL,
    target_type   VARCHAR(64)              NOT NULL,
    target_id     VARCHAR(128),
    details       VARCHAR(1024),
    ip_address    VARCHAR(64),
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_logs_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE,
    CONSTRAINT fk_audit_logs_actor_user FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_logs_merchant_id ON audit_logs (merchant_id);
CREATE INDEX idx_audit_logs_actor_user_id ON audit_logs (actor_user_id);
