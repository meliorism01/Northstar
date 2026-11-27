package com.ordexa.intervention.entity;

import com.ordexa.intervention.model.InterventionEnums.InterventionOutcomeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
@Table(name = "intervention_outcomes")
public class InterventionOutcome {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "merchant_id", nullable = false, updatable = false)
    private UUID merchantId;

    @Column(name = "recommendation_id", nullable = false, updatable = false)
    private UUID recommendationId;

    @Column(name = "item_id", nullable = false, updatable = false)
    private UUID itemId;

    @Column(name = "idempotency_key", nullable = false, updatable = false, unique = true, length = 128)
    private String idempotencyKey;

    @Enumerated(EnumType.STRING)
    @Column(name = "outcome_type", nullable = false, length = 48)
    private InterventionOutcomeType outcomeType;

    @Column(name = "outcome_source", nullable = false, length = 48)
    private String outcomeSource;

    @Column(name = "verified_response", nullable = false)
    private boolean verifiedResponse;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "minimized_payload", nullable = false)
    private Map<String, Object> minimizedPayload = new LinkedHashMap<>();

    @Column(name = "recorded_by_user_id")
    private UUID recordedByUserId;

    @Column(name = "recorded_at", nullable = false, updatable = false)
    private OffsetDateTime recordedAt;

    protected InterventionOutcome() {
    }

    public InterventionOutcome(
            UUID merchantId,
            UUID recommendationId,
            UUID itemId,
            String idempotencyKey,
            InterventionOutcomeType outcomeType,
            String outcomeSource,
            boolean verifiedResponse,
            Map<String, Object> minimizedPayload,
            UUID recordedByUserId,
            OffsetDateTime recordedAt) {
        this.id = UUID.randomUUID();
        this.merchantId = merchantId;
        this.recommendationId = recommendationId;
        this.itemId = itemId;
        this.idempotencyKey = idempotencyKey;
        this.outcomeType = outcomeType;
        this.outcomeSource = outcomeSource;
        this.verifiedResponse = verifiedResponse;
        this.minimizedPayload = minimizedPayload != null
                ? new LinkedHashMap<>(minimizedPayload)
                : new LinkedHashMap<>();
        this.recordedByUserId = recordedByUserId;
        this.recordedAt = recordedAt != null ? recordedAt : OffsetDateTime.now(ZoneOffset.UTC);
    }

    @PrePersist
    void onCreate() {
        if (this.id == null) {
            this.id = UUID.randomUUID();
        }
        if (this.recordedAt == null) {
            this.recordedAt = OffsetDateTime.now(ZoneOffset.UTC);
        }
    }

    public UUID getId() { return id; }
    public UUID getMerchantId() { return merchantId; }
    public UUID getRecommendationId() { return recommendationId; }
    public UUID getItemId() { return itemId; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public InterventionOutcomeType getOutcomeType() { return outcomeType; }
    public String getOutcomeSource() { return outcomeSource; }
    public boolean isVerifiedResponse() { return verifiedResponse; }
    public Map<String, Object> getMinimizedPayload() { return minimizedPayload; }
    public UUID getRecordedByUserId() { return recordedByUserId; }
    public OffsetDateTime getRecordedAt() { return recordedAt; }
}
