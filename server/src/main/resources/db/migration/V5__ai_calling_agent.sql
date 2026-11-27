-- ============================================================================
-- Migration: V5__ai_calling_agent.sql
-- Purpose:   Milestone 5 — AI Calling Agent & COD Verification Workflow:
--            1. Merchant-scoped calling_configurations & customer_calling_preferences.
--            2. call_sessions, call_attempts, call_transcripts, and call_events
--               with strict idempotency keys, optimistic locking, and FK safety.
--            3. Expand customer_behavioural_events event_type check constraint
--               to record structured AI calling verification milestones.
-- ============================================================================

ALTER TABLE customer_behavioural_events
    DROP CONSTRAINT chk_cbe_event_type;

ALTER TABLE customer_behavioural_events
    ADD CONSTRAINT chk_cbe_event_type CHECK (event_type IN (
        'CUSTOMER_CREATED',
        'CUSTOMER_PROFILE_UPDATED',
        'REPEAT_PURCHASE',
        'PAYMENT_COMPLETED',
        'CALL_VERIFICATION_CONFIRMED',
        'CALL_VERIFICATION_REJECTED',
        'CALL_CANCELLATION_REQUESTED',
        'CALL_NO_ANSWER',
        'CALL_HUMAN_ESCALATION'
    ));

CREATE TABLE calling_configurations (
    id                           UUID                     PRIMARY KEY,
    merchant_id                  UUID                     NOT NULL,
    enabled                      BOOLEAN                  NOT NULL DEFAULT TRUE,
    provider                     VARCHAR(32)              NOT NULL DEFAULT 'SANDBOX',
    default_language             VARCHAR(16)              NOT NULL DEFAULT 'hi-IN',
    supported_languages          VARCHAR(128)             NOT NULL DEFAULT 'hi-IN,en-IN',
    max_attempts                 INTEGER                  NOT NULL DEFAULT 3,
    retry_backoff_minutes_1      INTEGER                  NOT NULL DEFAULT 30,
    retry_backoff_minutes_2      INTEGER                  NOT NULL DEFAULT 120,
    call_timeout_seconds         INTEGER                  NOT NULL DEFAULT 90,
    dnd_start_hour_ist           INTEGER                  NOT NULL DEFAULT 21,
    dnd_end_hour_ist             INTEGER                  NOT NULL DEFAULT 9,
    dnd_resume_minute_ist        INTEGER                  NOT NULL DEFAULT 5,
    auto_confirm_order_on_yes    BOOLEAN                  NOT NULL DEFAULT TRUE,
    auto_cancel_order_on_request BOOLEAN                  NOT NULL DEFAULT FALSE,
    created_at                   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_calling_cfg_merchant UNIQUE (merchant_id),
    CONSTRAINT fk_calling_cfg_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE,
    CONSTRAINT chk_calling_cfg_max_attempts CHECK (max_attempts BETWEEN 1 AND 10)
);

CREATE TABLE customer_calling_preferences (
    id                 UUID                     PRIMARY KEY,
    merchant_id        UUID                     NOT NULL,
    customer_id        UUID                     NOT NULL,
    opted_out          BOOLEAN                  NOT NULL DEFAULT FALSE,
    opted_out_reason   VARCHAR(255),
    opted_out_at       TIMESTAMP WITH TIME ZONE,
    preferred_language VARCHAR(16),
    created_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_cust_call_pref UNIQUE (merchant_id, customer_id),
    CONSTRAINT fk_cust_call_pref_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE,
    CONSTRAINT fk_cust_call_pref_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
);

CREATE TABLE call_sessions (
    id                      UUID                     PRIMARY KEY,
    merchant_id             UUID                     NOT NULL,
    order_id                UUID                     NOT NULL,
    customer_id             UUID                     NOT NULL,
    idempotency_key         VARCHAR(128)             NOT NULL,
    phone_number            VARCHAR(24)              NOT NULL,
    language                VARCHAR(16)              NOT NULL DEFAULT 'hi-IN',
    status                  VARCHAR(32)              NOT NULL,
    final_outcome           VARCHAR(32),
    attempt_count           INTEGER                  NOT NULL DEFAULT 0,
    max_attempts            INTEGER                  NOT NULL DEFAULT 3,
    do_not_call_further     BOOLEAN                  NOT NULL DEFAULT FALSE,
    rto_risk_score_snapshot INTEGER                  NOT NULL DEFAULT 0,
    rto_risk_band_snapshot  VARCHAR(16)              NOT NULL DEFAULT 'LOW',
    updated_rto_risk_score  INTEGER,
    updated_rto_risk_band   VARCHAR(16),
    ai_summary              VARCHAR(1024),
    customer_intent         VARCHAR(255),
    recommended_action      VARCHAR(255),
    last_error              VARCHAR(512),
    last_attempt_at         TIMESTAMP WITH TIME ZONE,
    next_attempt_at         TIMESTAMP WITH TIME ZONE,
    completed_at            TIMESTAMP WITH TIME ZONE,
    version                 BIGINT                   NOT NULL DEFAULT 0,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_call_sessions_merchant_order UNIQUE (merchant_id, order_id),
    CONSTRAINT uq_call_sessions_idempotency UNIQUE (idempotency_key),
    CONSTRAINT fk_call_sessions_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE,
    CONSTRAINT fk_call_sessions_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
    CONSTRAINT fk_call_sessions_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE,
    CONSTRAINT chk_call_sessions_status CHECK (status IN (
        'QUEUED',
        'DISPATCHING',
        'IN_PROGRESS',
        'RETRY_SCHEDULED',
        'COMPLETED',
        'ESCALATED',
        'STOPPED',
        'FAILED'
    )),
    CONSTRAINT chk_call_sessions_outcome CHECK (final_outcome IS NULL OR final_outcome IN (
        'CONFIRMED',
        'REJECTED',
        'CANCELLATION_REQUESTED',
        'NO_ANSWER',
        'BUSY',
        'UNCERTAIN',
        'INVALID_NUMBER',
        'HUMAN_ESCALATION',
        'CALL_FAILED'
    ))
);

CREATE INDEX idx_call_sessions_merchant_status_next
    ON call_sessions (merchant_id, status, next_attempt_at);

CREATE INDEX idx_call_sessions_due_queue
    ON call_sessions (status, next_attempt_at);

CREATE INDEX idx_call_sessions_merchant_customer
    ON call_sessions (merchant_id, customer_id, created_at DESC);

CREATE TABLE call_attempts (
    id                UUID                     PRIMARY KEY,
    merchant_id       UUID                     NOT NULL,
    call_session_id   UUID                     NOT NULL,
    attempt_number    INTEGER                  NOT NULL,
    idempotency_key   VARCHAR(128)             NOT NULL,
    provider          VARCHAR(32)              NOT NULL,
    provider_call_id  VARCHAR(128),
    room_name         VARCHAR(160),
    status            VARCHAR(32)              NOT NULL,
    outcome           VARCHAR(32),
    language          VARCHAR(16)              NOT NULL,
    duration_seconds  INTEGER,
    recording_url     VARCHAR(512),
    consent_disclosed BOOLEAN                  NOT NULL DEFAULT TRUE,
    failure_reason    VARCHAR(512),
    started_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    answered_at       TIMESTAMP WITH TIME ZONE,
    ended_at          TIMESTAMP WITH TIME ZONE,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_call_attempts_session_num UNIQUE (call_session_id, attempt_number),
    CONSTRAINT uq_call_attempts_idempotency UNIQUE (idempotency_key),
    CONSTRAINT fk_call_attempts_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE,
    CONSTRAINT fk_call_attempts_session FOREIGN KEY (call_session_id) REFERENCES call_sessions (id) ON DELETE CASCADE,
    CONSTRAINT chk_call_attempts_status CHECK (status IN (
        'INITIATED',
        'RINGING',
        'IN_PROGRESS',
        'COMPLETED',
        'NO_ANSWER',
        'BUSY',
        'TIMED_OUT',
        'FAILED'
    ))
);

CREATE INDEX idx_call_attempts_session
    ON call_attempts (call_session_id, attempt_number ASC);

CREATE INDEX idx_call_attempts_provider_call
    ON call_attempts (provider_call_id);

CREATE TABLE call_transcripts (
    id              UUID                     PRIMARY KEY,
    merchant_id     UUID                     NOT NULL,
    call_session_id UUID                     NOT NULL,
    call_attempt_id UUID                     NOT NULL,
    turn_index      INTEGER                  NOT NULL,
    speaker_role    VARCHAR(24)              NOT NULL,
    utterance_text  VARCHAR(2048)            NOT NULL,
    language        VARCHAR(16),
    confidence      NUMERIC(5, 4),
    occurred_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_call_transcripts_attempt_turn UNIQUE (call_attempt_id, turn_index),
    CONSTRAINT fk_call_transcripts_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE,
    CONSTRAINT fk_call_transcripts_session FOREIGN KEY (call_session_id) REFERENCES call_sessions (id) ON DELETE CASCADE,
    CONSTRAINT fk_call_transcripts_attempt FOREIGN KEY (call_attempt_id) REFERENCES call_attempts (id) ON DELETE CASCADE,
    CONSTRAINT chk_call_transcripts_role CHECK (speaker_role IN ('AGENT', 'CUSTOMER', 'SYSTEM', 'TOOL'))
);

CREATE INDEX idx_call_transcripts_session
    ON call_transcripts (call_session_id, call_attempt_id, turn_index ASC);

CREATE TABLE call_events (
    id               UUID                     PRIMARY KEY,
    merchant_id      UUID                     NOT NULL,
    call_session_id  UUID                     NOT NULL,
    call_attempt_id  UUID,
    webhook_event_id VARCHAR(128),
    event_type       VARCHAR(48)              NOT NULL,
    actor            VARCHAR(120)             NOT NULL,
    details          VARCHAR(1024),
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_call_events_webhook_id UNIQUE (webhook_event_id),
    CONSTRAINT fk_call_events_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE,
    CONSTRAINT fk_call_events_session FOREIGN KEY (call_session_id) REFERENCES call_sessions (id) ON DELETE CASCADE,
    CONSTRAINT fk_call_events_attempt FOREIGN KEY (call_attempt_id) REFERENCES call_attempts (id) ON DELETE SET NULL
);

CREATE INDEX idx_call_events_session_created
    ON call_events (call_session_id, created_at ASC);
