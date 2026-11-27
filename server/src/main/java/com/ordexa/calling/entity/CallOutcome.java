package com.ordexa.calling.entity;

public enum CallOutcome {
    CONFIRMED,
    REJECTED,
    CANCELLATION_REQUESTED,
    NO_ANSWER,
    BUSY,
    UNCERTAIN,
    INVALID_NUMBER,
    HUMAN_ESCALATION,
    CALL_FAILED;

    public boolean isRetryable() {
        return this == NO_ANSWER || this == BUSY || this == CALL_FAILED || this == UNCERTAIN;
    }
}
