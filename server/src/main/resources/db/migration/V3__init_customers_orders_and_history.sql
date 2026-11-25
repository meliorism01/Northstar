-- ============================================================================
-- Migration: V3__init_customers_orders_and_history.sql
-- Purpose:   Multi-tenant Order Management Core: merchant-scoped customers,
--            orders, order_items, and order_status_history.
-- ============================================================================

-- 1. CUSTOMERS (Merchant-scoped; phone numbers are unique per merchant, never globally)
CREATE TABLE customers (
    id             UUID                     PRIMARY KEY,
    merchant_id    UUID                     NOT NULL,
    full_name      VARCHAR(160)             NOT NULL,
    phone_number   VARCHAR(32)              NOT NULL,
    email          VARCHAR(255),
    total_orders   INTEGER                  NOT NULL DEFAULT 0,
    total_spent    NUMERIC(14, 2)           NOT NULL DEFAULT 0.00,
    first_order_at TIMESTAMP WITH TIME ZONE,
    last_order_at  TIMESTAMP WITH TIME ZONE,
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version        BIGINT                   NOT NULL DEFAULT 0,
    CONSTRAINT fk_customers_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE,
    CONSTRAINT uq_customers_merchant_phone UNIQUE (merchant_id, phone_number),
    CONSTRAINT chk_customers_totals CHECK (total_orders >= 0 AND total_spent >= 0)
);

CREATE INDEX idx_customers_merchant_id ON customers (merchant_id);
CREATE INDEX idx_customers_merchant_name ON customers (merchant_id, full_name);
CREATE INDEX idx_customers_merchant_email ON customers (merchant_id, email);

-- 2. ORDERS (Merchant-scoped; order_number is unique per merchant)
CREATE TABLE orders (
    id               UUID                     PRIMARY KEY,
    merchant_id      UUID                     NOT NULL,
    order_number     VARCHAR(64)              NOT NULL,
    customer_id      UUID                     NOT NULL,
    source           VARCHAR(32)              NOT NULL,
    order_status     VARCHAR(32)              NOT NULL,
    payment_status   VARCHAR(32)              NOT NULL,
    payment_method   VARCHAR(32)              NOT NULL,
    subtotal         NUMERIC(14, 2)           NOT NULL,
    discount         NUMERIC(14, 2)           NOT NULL DEFAULT 0.00,
    shipping_fee     NUMERIC(14, 2)           NOT NULL DEFAULT 0.00,
    total_amount     NUMERIC(14, 2)           NOT NULL,
    currency         VARCHAR(8)               NOT NULL DEFAULT 'INR',
    shipping_address VARCHAR(1024)            NOT NULL,
    billing_address  VARCHAR(1024),
    customer_notes   VARCHAR(1024),
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version          BIGINT                   NOT NULL DEFAULT 0,
    CONSTRAINT fk_orders_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE,
    CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT,
    CONSTRAINT uq_orders_merchant_order_number UNIQUE (merchant_id, order_number),
    CONSTRAINT chk_orders_source CHECK (source IN ('MANUAL', 'SHOPIFY', 'WOOCOMMERCE', 'CSV')),
    CONSTRAINT chk_orders_status CHECK (order_status IN ('CREATED', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED')),
    CONSTRAINT chk_orders_payment_status CHECK (payment_status IN ('PENDING', 'PAID', 'PARTIALLY_PAID', 'REFUNDED', 'FAILED')),
    CONSTRAINT chk_orders_payment_method CHECK (payment_method IN ('COD', 'PREPAID', 'UPI', 'CARD', 'NETBANKING')),
    CONSTRAINT chk_orders_amounts CHECK (subtotal >= 0 AND discount >= 0 AND shipping_fee >= 0 AND total_amount >= 0)
);

CREATE INDEX idx_orders_merchant_created_at ON orders (merchant_id, created_at DESC);
CREATE INDEX idx_orders_merchant_status ON orders (merchant_id, order_status);
CREATE INDEX idx_orders_merchant_payment_status ON orders (merchant_id, payment_status);
CREATE INDEX idx_orders_merchant_customer ON orders (merchant_id, customer_id);

-- 3. ORDER ITEMS (Merchant-scoped line items)
CREATE TABLE order_items (
    id           UUID           PRIMARY KEY,
    merchant_id  UUID           NOT NULL,
    order_id     UUID           NOT NULL,
    product_name VARCHAR(255)   NOT NULL,
    sku          VARCHAR(120)   NOT NULL,
    quantity     INTEGER        NOT NULL,
    unit_price   NUMERIC(14, 2) NOT NULL,
    total_price  NUMERIC(14, 2) NOT NULL,
    CONSTRAINT fk_order_items_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE,
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
    CONSTRAINT chk_order_items_qty_price CHECK (quantity > 0 AND unit_price >= 0 AND total_price >= 0)
);

CREATE INDEX idx_order_items_order_id ON order_items (order_id);
CREATE INDEX idx_order_items_merchant_id ON order_items (merchant_id);

-- 4. ORDER STATUS HISTORY (Immutable audit trail of every order status change)
CREATE TABLE order_status_history (
    id              UUID                     PRIMARY KEY,
    merchant_id     UUID                     NOT NULL,
    order_id        UUID                     NOT NULL,
    previous_status VARCHAR(32),
    new_status      VARCHAR(32)              NOT NULL,
    changed_by      VARCHAR(160)             NOT NULL,
    reason          VARCHAR(512),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_order_history_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE,
    CONSTRAINT fk_order_history_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
);

CREATE INDEX idx_order_history_order_id ON order_status_history (order_id, created_at ASC);
CREATE INDEX idx_order_history_merchant_id ON order_status_history (merchant_id);
