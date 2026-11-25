-- ============================================================================
-- Migration: V4__customer_intelligence.sql
-- Purpose:   Milestone 4 — Customer Intelligence Graph:
--            1. Customer behavioural events table for merchant-scoped customer
--               milestones not already represented in order_status_history.
--            2. Targeted composite indexes on orders and order_items for fast
--               merchant-scoped customer, product, and co-purchase aggregation.
-- ============================================================================

CREATE TABLE customer_behavioural_events (
    id          UUID                     PRIMARY KEY,
    merchant_id UUID                     NOT NULL,
    customer_id UUID                     NOT NULL,
    order_id    UUID,
    event_type  VARCHAR(48)              NOT NULL,
    title       VARCHAR(160)             NOT NULL,
    description VARCHAR(512),
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cbe_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE,
    CONSTRAINT fk_cbe_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE,
    CONSTRAINT fk_cbe_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE SET NULL,
    CONSTRAINT chk_cbe_event_type CHECK (event_type IN (
        'CUSTOMER_CREATED',
        'CUSTOMER_PROFILE_UPDATED',
        'REPEAT_PURCHASE',
        'PAYMENT_COMPLETED'
    ))
);

CREATE INDEX idx_cbe_merchant_customer_time
    ON customer_behavioural_events (merchant_id, customer_id, occurred_at DESC);

CREATE INDEX idx_cbe_merchant_type
    ON customer_behavioural_events (merchant_id, event_type);

-- Optimize merchant-scoped product aggregation and co-purchase queries
CREATE INDEX idx_order_items_merchant_sku
    ON order_items (merchant_id, sku);

CREATE INDEX idx_order_items_merchant_order_sku
    ON order_items (merchant_id, order_id, sku);

-- Optimize merchant-scoped customer order outcome & payment analytics
CREATE INDEX idx_orders_merchant_customer_status_created
    ON orders (merchant_id, customer_id, order_status, created_at DESC);
