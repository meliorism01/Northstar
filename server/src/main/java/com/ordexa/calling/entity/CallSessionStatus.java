package com.ordexa.calling.entity;

public enum CallSessionStatus {
    QUEUED,
    DISPATCHING,
    IN_PROGRESS,
    RETRY_SCHEDULED,
    COMPLETED,
    ESCALATED,
    STOPPED,
    FAILED;

    public boolean isTerminal() {
        return this == COMPLETED || this == ESCALATED || this == STOPPED || this == FAILED;
    }
}
