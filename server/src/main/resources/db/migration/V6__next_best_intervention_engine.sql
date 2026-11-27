-- ============================================================================
-- Migration: V6__next_best_intervention_engine.sql
-- Purpose:   Next-Best-Intervention Engine (NBIE) — Pre-dispatch explainable,
--            deterministic intervention recommendations, action-only approvals,
--            sandbox execution logs, outcome capture, consent provenance,
--            merchant policy configuration, and append-only audit events.
--
-- Authority: NBIE recommends interventions ONLY. Check constraints strictly
--            forbid order-level decisions (APPROVE/DECLINE/CANCEL/HOLD/RELEASE)
--            and forbid non-sandbox execution modes.
-- ============================================================================

-- 1. MERCHANT INTERVENTION POLICIES
CREATE TABLE intervention_policies (
    id                               UUID                     PRIMARY KEY,
    merchant_id                      UUID                     NOT NULL,
    enabled                          BOOLEAN                  NOT NULL DEFAULT TRUE,
    cod_confirmation_enabled         BOOLEAN                  NOT NULL DEFAULT TRUE,
    address_clarification_enabled    BOOLEAN                  NOT NULL DEFAULT TRUE,
    human_review_enabled             BOOLEAN                  NOT NULL DEFAULT TRUE,
    partial_advance_enabled          BOOLEAN                  NOT NULL DEFAULT FALSE,
    partial_advance_payment_capable  BOOLEAN                  NOT NULL DEFAULT FALSE,
    partial_advance_min_order_value  NUMERIC(14, 2)           NOT NULL DEFAULT 2500.00,
    cod_confirmation_min_order_value NUMERIC(14, 2)           NOT NULL DEFAULT 0.00,
    enabled_channels                 VARCHAR(128)             NOT NULL DEFAULT 'VOICE_SANDBOX',
    max_contacts_per_order           INTEGER                  NOT NULL DEFAULT 3,
    max_contacts_per_customer_24h    INTEGER                  NOT NULL DEFAULT 3,
    min_hours_between_contacts       INTEGER                  NOT NULL DEFAULT 2,
    recommendation_ttl_hours         INTEGER                  NOT NULL DEFAULT 24,
    max_rto_assessment_age_minutes   INTEGER                  NOT NULL DEFAULT 60,
    require_approval_for_contact     BOOLEAN                  NOT NULL DEFAULT TRUE,
    version                          BIGINT                   NOT NULL DEFAULT 0,
    created_at                       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_intervention_policies_merchant UNIQUE (merchant_id),
    CONSTRAINT fk_intervention_policies_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE,
    CONSTRAINT chk_intervention_policy_caps CHECK (
        max_contacts_per_order BETWEEN 0 AND 10
        AND max_contacts_per_customer_24h BETWEEN 0 AND 20
        AND min_hours_between_contacts BETWEEN 0 AND 72
        AND recommendation_ttl_hours BETWEEN 1 AND 168
        AND max_rto_assessment_age_minutes BETWEEN 1 AND 1440
        AND partial_advance_min_order_value >= 0
        AND cod_confirmation_min_order_value >= 0
    )
);

-- 2. CUSTOMER COMMUNICATION CONSENT PROVENANCE (Merchant-scoped; unknown consent != permission)
CREATE TABLE intervention_customer_consents (
    id                 UUID                     PRIMARY KEY,
    merchant_id        UUID                     NOT NULL,
    customer_id        UUID                     NOT NULL,
    consent_status     VARCHAR(24)              NOT NULL DEFAULT 'UNKNOWN',
    permitted_channels VARCHAR(128)             NOT NULL DEFAULT 'VOICE_SANDBOX',
    consent_source     VARCHAR(64)              NOT NULL DEFAULT 'UNSPECIFIED',
    recorded_by_user   UUID,
    recorded_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_int_cust_consent UNIQUE (merchant_id, customer_id),
    CONSTRAINT fk_int_cust_consent_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE,
    CONSTRAINT fk_int_cust_consent_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE,
    CONSTRAINT fk_int_cust_consent_actor FOREIGN KEY (recorded_by_user) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT chk_int_cust_consent_status CHECK (consent_status IN ('GRANTED', 'DENIED', 'UNKNOWN'))
);

CREATE INDEX idx_int_cust_consent_merchant_customer
    ON intervention_customer_consents (merchant_id, customer_id);

-- 3. INTERVENTION RECOMMENDATIONS (Order-scoped evaluation envelope & minimized evidence snapshot)
CREATE TABLE intervention_recommendations (
    id                      UUID                     PRIMARY KEY,
    merchant_id             UUID                     NOT NULL,
    order_id                UUID                     NOT NULL,
    customer_id             UUID                     NOT NULL,
    status                  VARCHAR(40)              NOT NULL,
    evaluation_status       VARCHAR(48)              NOT NULL,
    ruleset_version         VARCHAR(48)              NOT NULL,
    idempotency_fingerprint VARCHAR(128)             NOT NULL,
    active_record           BOOLEAN                  NOT NULL DEFAULT TRUE,
    rto_score               INTEGER,
    rto_band                VARCHAR(24),
    rto_reason_codes        VARCHAR(512),
    rto_assessed_at         TIMESTAMP WITH TIME ZONE,
    evidence_completeness   VARCHAR(24)              NOT NULL,
    evidence_snapshot       JSONB                    NOT NULL,
    superseded_by_id        UUID,
    evaluated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at              TIMESTAMP WITH TIME ZONE NOT NULL,
    version                 BIGINT                   NOT NULL DEFAULT 0,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_int_rec_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE,
    CONSTRAINT fk_int_rec_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
    CONSTRAINT fk_int_rec_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE,
    CONSTRAINT fk_int_rec_superseded_by FOREIGN KEY (superseded_by_id) REFERENCES intervention_recommendations (id) ON DELETE SET NULL,
    CONSTRAINT chk_int_rec_status CHECK (status IN (
        'RECOMMENDED',
        'ACTION_APPROVAL_PENDING',
        'ACTION_APPROVED',
        'ACTION_REJECTED',
        'EXECUTION_PENDING',
        'EXECUTING',
        'EXECUTED',
        'OUTCOME_PENDING',
        'COMPLETED',
        'EXPIRED',
        'SUPERSEDED',
        'FAILED'
    )),
    CONSTRAINT chk_int_rec_eval_status CHECK (evaluation_status IN (
        'COMPLETED',
        'ASSESSMENT_UNAVAILABLE',
        'ASSESSMENT_STALE_REFRESH_REQUIRED',
        'NOT_APPLICABLE_POST_DISPATCH',
        'NOT_APPLICABLE_CANCELLED',
        'POLICY_DISABLED'
    )),
    CONSTRAINT chk_int_rec_evidence_comp CHECK (evidence_completeness IN (
        'HIGH',
        'MEDIUM',
        'LOW',
        'INSUFFICIENT'
    )),
    CONSTRAINT chk_int_rec_rto_band CHECK (rto_band IS NULL OR rto_band IN ('LOW', 'MEDIUM', 'HIGH'))
);

CREATE INDEX idx_int_rec_merchant_active_status
    ON intervention_recommendations (merchant_id, active_record, status, evaluated_at DESC);

CREATE INDEX idx_int_rec_merchant_order_eval
    ON intervention_recommendations (merchant_id, order_id, evaluated_at DESC);

CREATE INDEX idx_int_rec_merchant_order_fingerprint
    ON intervention_recommendations (merchant_id, order_id, idempotency_fingerprint);

-- 4. INTERVENTION RECOMMENDATION ITEMS (Ranked primary & secondary actions; NEVER order decisions)
CREATE TABLE intervention_recommendation_items (
    id                  UUID                     PRIMARY KEY,
    merchant_id         UUID                     NOT NULL,
    recommendation_id   UUID                     NOT NULL,
    intervention_type   VARCHAR(40)              NOT NULL,
    item_role           VARCHAR(24)              NOT NULL,
    rank_order          INTEGER                  NOT NULL,
    priority            VARCHAR(24)              NOT NULL,
    status              VARCHAR(40)              NOT NULL,
    proposed_channel    VARCHAR(32)              NOT NULL,
    triggered_rule_ids  VARCHAR(255)             NOT NULL,
    reason_codes        VARCHAR(512)             NOT NULL,
    explanation         VARCHAR(1024)            NOT NULL,
    required_evidence   VARCHAR(512),
    approval_required   BOOLEAN                  NOT NULL DEFAULT TRUE,
    version             BIGINT                   NOT NULL DEFAULT 0,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_int_item_rec_rank UNIQUE (recommendation_id, rank_order),
    CONSTRAINT uq_int_item_rec_type UNIQUE (recommendation_id, intervention_type),
    CONSTRAINT fk_int_item_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE,
    CONSTRAINT fk_int_item_rec FOREIGN KEY (recommendation_id) REFERENCES intervention_recommendations (id) ON DELETE CASCADE,
    CONSTRAINT chk_int_item_type CHECK (intervention_type IN (
        'COD_CONFIRMATION',
        'ADDRESS_CLARIFICATION',
        'HUMAN_REVIEW',
        'OPTIONAL_PARTIAL_ADVANCE',
        'NO_INTERVENTION'
    )),
    CONSTRAINT chk_int_item_role CHECK (item_role IN ('PRIMARY', 'SECONDARY')),
    CONSTRAINT chk_int_item_priority CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW', 'NONE')),
    CONSTRAINT chk_int_item_status CHECK (status IN (
        'RECOMMENDED',
        'ACTION_APPROVAL_PENDING',
        'ACTION_APPROVED',
        'ACTION_REJECTED',
        'EXECUTION_PENDING',
        'EXECUTING',
        'EXECUTED',
        'OUTCOME_PENDING',
        'COMPLETED',
        'EXPIRED',
        'SUPERSEDED',
        'FAILED'
    ))
);

CREATE INDEX idx_int_item_merchant_status_priority
    ON intervention_recommendation_items (merchant_id, status, priority);

CREATE INDEX idx_int_item_rec_rank
    ON intervention_recommendation_items (recommendation_id, rank_order ASC);

-- 5. INTERVENTION APPROVALS (Authorizes or rejects an intervention action ONLY — never approves/declines an order)
CREATE TABLE intervention_approvals (
    id                UUID                     PRIMARY KEY,
    merchant_id       UUID                     NOT NULL,
    recommendation_id UUID                     NOT NULL,
    item_id           UUID                     NOT NULL,
    actor_user_id     UUID                     NOT NULL,
    actor_role        VARCHAR(32)              NOT NULL,
    decision          VARCHAR(24)              NOT NULL,
    note              VARCHAR(512),
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_int_approval_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE,
    CONSTRAINT fk_int_approval_rec FOREIGN KEY (recommendation_id) REFERENCES intervention_recommendations (id) ON DELETE CASCADE,
    CONSTRAINT fk_int_approval_item FOREIGN KEY (item_id) REFERENCES intervention_recommendation_items (id) ON DELETE CASCADE,
    CONSTRAINT fk_int_approval_actor FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT chk_int_approval_decision CHECK (decision IN ('ACTION_APPROVED', 'ACTION_REJECTED'))
);

CREATE INDEX idx_int_approval_merchant_item
    ON intervention_approvals (merchant_id, item_id, created_at DESC);

CREATE INDEX idx_int_approval_rec
    ON intervention_approvals (recommendation_id, created_at ASC);

-- 6. INTERVENTION EXECUTION LOGS (Sandbox/Dry-Run/Internal adapter boundary only)
CREATE TABLE intervention_execution_logs (
    id                    UUID                     PRIMARY KEY,
    merchant_id           UUID                     NOT NULL,
    recommendation_id     UUID                     NOT NULL,
    item_id               UUID                     NOT NULL,
    idempotency_key       VARCHAR(128)             NOT NULL,
    adapter_code          VARCHAR(48)              NOT NULL,
    channel               VARCHAR(32)              NOT NULL,
    provider_mode         VARCHAR(24)              NOT NULL,
    execution_status      VARCHAR(32)              NOT NULL,
    external_reference_id VARCHAR(128),
    sanitized_metadata    JSONB                    NOT NULL,
    executed_by_user_id   UUID,
    executed_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_int_exec_idempotency UNIQUE (idempotency_key),
    CONSTRAINT fk_int_exec_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE,
    CONSTRAINT fk_int_exec_rec FOREIGN KEY (recommendation_id) REFERENCES intervention_recommendations (id) ON DELETE CASCADE,
    CONSTRAINT fk_int_exec_item FOREIGN KEY (item_id) REFERENCES intervention_recommendation_items (id) ON DELETE CASCADE,
    CONSTRAINT fk_int_exec_actor FOREIGN KEY (executed_by_user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT chk_int_exec_provider_mode CHECK (provider_mode IN ('SANDBOX', 'DRY_RUN', 'INTERNAL')),
    CONSTRAINT chk_int_exec_status CHECK (execution_status IN (
        'ACCEPTED_SANDBOX',
        'SKIPPED_DUPLICATE',
        'BLOCKED_POLICY',
        'BLOCKED_CONSENT',
        'FAILED'
    ))
);

CREATE INDEX idx_int_exec_merchant_item_time
    ON intervention_execution_logs (merchant_id, item_id, executed_at DESC);

CREATE INDEX idx_int_exec_merchant_rec_time
    ON intervention_execution_logs (merchant_id, recommendation_id, executed_at ASC);

-- 7. INTERVENTION OUTCOMES (Verified or inconclusive outcome records; never infers fraud from silence)
CREATE TABLE intervention_outcomes (
    id                  UUID                     PRIMARY KEY,
    merchant_id         UUID                     NOT NULL,
    recommendation_id   UUID                     NOT NULL,
    item_id             UUID                     NOT NULL,
    idempotency_key     VARCHAR(128)             NOT NULL,
    outcome_type        VARCHAR(48)              NOT NULL,
    outcome_source      VARCHAR(48)              NOT NULL,
    verified_response   BOOLEAN                  NOT NULL DEFAULT FALSE,
    minimized_payload   JSONB                    NOT NULL,
    recorded_by_user_id UUID,
    recorded_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_int_outcome_idempotency UNIQUE (idempotency_key),
    CONSTRAINT fk_int_outcome_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE,
    CONSTRAINT fk_int_outcome_rec FOREIGN KEY (recommendation_id) REFERENCES intervention_recommendations (id) ON DELETE CASCADE,
    CONSTRAINT fk_int_outcome_item FOREIGN KEY (item_id) REFERENCES intervention_recommendation_items (id) ON DELETE CASCADE,
    CONSTRAINT fk_int_outcome_actor FOREIGN KEY (recorded_by_user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT chk_int_outcome_type CHECK (outcome_type IN (
        'CUSTOMER_CONFIRMED_INTENT',
        'CUSTOMER_DENIED_ORDER',
        'CUSTOMER_REQUESTED_CANCELLATION',
        'ADDRESS_DETAILS_PROVIDED',
        'PARTIAL_ADVANCE_VOLUNTARILY_PAID',
        'PARTIAL_ADVANCE_DECLINED',
        'NO_ANSWER_INCONCLUSIVE',
        'BUSY_INCONCLUSIVE',
        'CONTACT_DELIVERY_FAILED',
        'HUMAN_REVIEW_RESOLVED',
        'HUMAN_REVIEW_UNRESOLVED'
    ))
);

CREATE INDEX idx_int_outcome_merchant_item_time
    ON intervention_outcomes (merchant_id, item_id, recorded_at DESC);

CREATE INDEX idx_int_outcome_merchant_rec_time
    ON intervention_outcomes (merchant_id, recommendation_id, recorded_at ASC);

-- 8. INTERVENTION APPEND-ONLY AUDIT EVENTS
CREATE TABLE intervention_audit_events (
    id                UUID                     PRIMARY KEY,
    merchant_id       UUID                     NOT NULL,
    order_id          UUID                     NOT NULL,
    recommendation_id UUID,
    item_id           UUID,
    actor_user_id     UUID,
    actor_label       VARCHAR(160)             NOT NULL,
    event_type        VARCHAR(64)              NOT NULL,
    ruleset_version   VARCHAR(48)              NOT NULL,
    correlation_id    VARCHAR(128),
    summary           VARCHAR(512)             NOT NULL,
    event_metadata    JSONB                    NOT NULL,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_int_audit_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE,
    CONSTRAINT fk_int_audit_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
    CONSTRAINT fk_int_audit_rec FOREIGN KEY (recommendation_id) REFERENCES intervention_recommendations (id) ON DELETE SET NULL,
    CONSTRAINT fk_int_audit_item FOREIGN KEY (item_id) REFERENCES intervention_recommendation_items (id) ON DELETE SET NULL,
    CONSTRAINT fk_int_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX idx_int_audit_merchant_order_time
    ON intervention_audit_events (merchant_id, order_id, created_at DESC);

CREATE INDEX idx_int_audit_rec_time
    ON intervention_audit_events (recommendation_id, created_at ASC);
