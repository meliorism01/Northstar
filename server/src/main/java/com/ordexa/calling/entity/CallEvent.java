package com.ordexa.calling.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Entity
@Table(name = "call_events")
public class CallEvent {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "merchant_id", nullable = false, updatable = false)
    private UUID merchantId;

    @Column(name = "call_session_id", nullable = false, updatable = false)
    private UUID callSessionId;

    @Column(name = "call_attempt_id", updatable = false)
    private UUID callAttemptId;

    @Column(name = "webhook_event_id", updatable = false, unique = true, length = 128)
    private String webhookEventId;

    @Column(name = "event_type", nullable = false, updatable = false, length = 48)
    private String eventType;

    @Column(name = "actor", nullable = false, updatable = false, length = 120)
    private String actor;

    @Column(name = "details", updatable = false, length = 1024)
    private String details;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected CallEvent() {
    }

    public CallEvent(
            UUID merchantId,
            UUID callSessionId,
            UUID callAttemptId,
            String webhookEventId,
            String eventType,
            String actor,
            String details,
            OffsetDateTime createdAt) {
        this.id = UUID.randomUUID();
        this.merchantId = merchantId;
        this.callSessionId = callSessionId;
        this.callAttemptId = callAttemptId;
        this.webhookEventId = (webhookEventId != null && !webhookEventId.isBlank()) ? webhookEventId : null;
        this.eventType = eventType;
        this.actor = actor;
        this.details = details != null && details.length() > 1024 ? details.substring(0, 1024) : details;
        this.createdAt = createdAt != null ? createdAt : OffsetDateTime.now(ZoneOffset.UTC);
    }

    @PrePersist
    void onCreate() {
        if (this.id == null) {
            this.id = UUID.randomUUID();
        }
        if (this.createdAt == null) {
            this.createdAt = OffsetDateTime.now(ZoneOffset.UTC);
        }
    }

    public UUID getId() { return id; }
    public UUID getMerchantId() { return merchantId; }
    public UUID getCallSessionId() { return callSessionId; }
    public UUID getCallAttemptId() { return callAttemptId; }
    public String getWebhookEventId() { return webhookEventId; }
    public String getEventType() { return eventType; }
    public String getActor() { return actor; }
    public String getDetails() { return details; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
