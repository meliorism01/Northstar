package com.ordexa.intervention.model;

import java.util.EnumSet;
import java.util.Set;

/**
 * Recommendation and recommendation-item lifecycle state machine.
 *
 * Completely independent from {@code OrderStatus}. Approving or rejecting an
 * intervention authorizes or declines that intervention ONLY — it never approves,
 * holds, cancels, or declines the underlying order.
 */
public enum InterventionStatus {
    RECOMMENDED,
    ACTION_APPROVAL_PENDING,
    ACTION_APPROVED,
    ACTION_REJECTED,
    EXECUTION_PENDING,
    EXECUTING,
    EXECUTED,
    OUTCOME_PENDING,
    COMPLETED,
    EXPIRED,
    SUPERSEDED,
    FAILED;

    public Set<InterventionStatus> allowedNextStatuses() {
        return switch (this) {
            case RECOMMENDED -> EnumSet.of(
                    ACTION_APPROVAL_PENDING,
                    ACTION_APPROVED,
                    ACTION_REJECTED,
                    COMPLETED,
                    EXPIRED,
                    SUPERSEDED
            );
            case ACTION_APPROVAL_PENDING -> EnumSet.of(
                    ACTION_APPROVED,
                    ACTION_REJECTED,
                    EXPIRED,
                    SUPERSEDED
            );
            case ACTION_APPROVED -> EnumSet.of(
                    EXECUTION_PENDING,
                    EXECUTING,
                    EXECUTED,
                    OUTCOME_PENDING,
                    COMPLETED,
                    FAILED,
                    EXPIRED,
                    SUPERSEDED
            );
            case ACTION_REJECTED -> EnumSet.of(
                    SUPERSEDED,
                    EXPIRED
            );
            case EXECUTION_PENDING -> EnumSet.of(
                    EXECUTING,
                    EXECUTED,
                    OUTCOME_PENDING,
                    FAILED,
                    EXPIRED,
                    SUPERSEDED
            );
            case EXECUTING -> EnumSet.of(
                    EXECUTED,
                    OUTCOME_PENDING,
                    COMPLETED,
                    FAILED
            );
            case EXECUTED -> EnumSet.of(
                    OUTCOME_PENDING,
                    COMPLETED,
                    EXPIRED,
                    SUPERSEDED
            );
            case OUTCOME_PENDING -> EnumSet.of(
                    COMPLETED,
                    FAILED,
                    EXPIRED,
                    SUPERSEDED
            );
            case COMPLETED, EXPIRED, FAILED -> EnumSet.of(SUPERSEDED);
            case SUPERSEDED -> EnumSet.noneOf(InterventionStatus.class);
        };
    }

    public boolean canTransitionTo(InterventionStatus target) {
        if (target == null || target == this) {
            return false;
        }
        return allowedNextStatuses().contains(target);
    }

    public boolean isTerminal() {
        return this == ACTION_REJECTED
                || this == COMPLETED
                || this == EXPIRED
                || this == SUPERSEDED
                || this == FAILED;
    }
}
