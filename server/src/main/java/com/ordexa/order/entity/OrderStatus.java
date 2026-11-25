package com.ordexa.order.entity;

import java.util.EnumSet;
import java.util.Set;

/**
 * Controlled Order Lifecycle State Machine:
 * CREATED -> CONFIRMED -> PROCESSING -> SHIPPED -> DELIVERED
 * Plus valid cancellation transitions:
 * CREATED -> CANCELLED
 * CONFIRMED -> CANCELLED
 * PROCESSING -> CANCELLED (before courier shipment handoff)
 */
public enum OrderStatus {
    CREATED,
    CONFIRMED,
    PROCESSING,
    SHIPPED,
    DELIVERED,
    CANCELLED;

    public Set<OrderStatus> allowedNextStatuses() {
        return switch (this) {
            case CREATED -> EnumSet.of(CONFIRMED, CANCELLED);
            case CONFIRMED -> EnumSet.of(PROCESSING, CANCELLED);
            case PROCESSING -> EnumSet.of(SHIPPED, CANCELLED);
            case SHIPPED -> EnumSet.of(DELIVERED);
            case DELIVERED, CANCELLED -> EnumSet.noneOf(OrderStatus.class);
        };
    }

    public boolean canTransitionTo(OrderStatus target) {
        if (target == null || target == this) {
            return false;
        }
        return allowedNextStatuses().contains(target);
    }

    public boolean isDeletable() {
        return this == CREATED || this == CANCELLED;
    }
}
