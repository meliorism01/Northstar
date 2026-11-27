package com.ordexa.intervention.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "intervention_audit_events")
public class InterventionAuditEvent {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "merchant_id", nullable = false, updatable = false)
    private UUID merchantId;

    @Column(name = "order_id", nullable = false, updatable = false)
    private UUID orderId;

    @Column(name = "recommendation_id")
    private UUID recommendationId;

    @Column(name = "item_id")
    private UUID itemId;

    @Column(name = "actor_user_id")
    private UUID actorUserId;

    @Column(name = "actor_label", nullable = false, length = 160)
    private String actorLabel;

    @Column(name = "event_type", nullable = false, length = 64)
    private String eventType;

    @Column(name = "ruleset_version", nullable = false, length = 48)
    private String rulesetVersion;

    @Column(name = "correlation_id", length = 128)
    private String correlationId;

    @Column(name = "summary", nullable = false, length = 512)
    private String summary;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "event_metadata", nullable = false)
    private Map<String, Object> eventMetadata = new LinkedHashMap<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected InterventionAuditEvent() {
    }

    public InterventionAuditEvent(
            UUID merchantId,
            UUID orderId,
            UUID recommendationId,
            UUID itemId,
            UUID actorUserId,
            String actorLabel,
            String eventType,
            String rulesetVersion,
            String correlationId,
            String summary,
            Map<String, Object> eventMetadata,
            OffsetDateTime createdAt) {
        this.id = UUID.randomUUID();
        this.merchantId = merchantId;
        this.orderId = orderId;
        this.recommendationId = recommendationId;
        this.itemId = itemId;
        this.actorUserId = actorUserId;
        this.actorLabel = actorLabel != null ? actorLabel : "SYSTEM";
        this.eventType = eventType;
        this.rulesetVersion = rulesetVersion;
        this.correlationId = correlationId;
        this.summary = summary;
        this.eventMetadata = eventMetadata != null ? new LinkedHashMap<>(eventMetadata) : new LinkedHashMap<>();
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
    public UUID getOrderId() { return orderId; }
    public UUID getRecommendationId() { return recommendationId; }
    public UUID getItemId() { return itemId; }
    public UUID getActorUserId() { return actorUserId; }
    public String getActorLabel() { return actorLabel; }
    public String getEventType() { return eventType; }
    public String getRulesetVersion() { return rulesetVersion; }
    public String getCorrelationId() { return correlationId; }
    public String getSummary() { return summary; }
    public Map<String, Object> getEventMetadata() { return eventMetadata; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
