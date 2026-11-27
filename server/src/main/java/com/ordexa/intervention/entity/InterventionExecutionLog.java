package com.ordexa.intervention.entity;

import com.ordexa.intervention.model.InterventionEnums.ExecutionLogStatus;
import com.ordexa.intervention.model.InterventionEnums.ExecutionProviderMode;
import com.ordexa.intervention.model.InterventionEnums.InterventionChannel;
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
@Table(name = "intervention_execution_logs")
public class InterventionExecutionLog {

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

    @Column(name = "adapter_code", nullable = false, length = 48)
    private String adapterCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "channel", nullable = false, length = 32)
    private InterventionChannel channel;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider_mode", nullable = false, length = 24)
    private ExecutionProviderMode providerMode;

    @Enumerated(EnumType.STRING)
    @Column(name = "execution_status", nullable = false, length = 32)
    private ExecutionLogStatus executionStatus;

    @Column(name = "external_reference_id", length = 128)
    private String externalReferenceId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "sanitized_metadata", nullable = false)
    private Map<String, Object> sanitizedMetadata = new LinkedHashMap<>();

    @Column(name = "executed_by_user_id")
    private UUID executedByUserId;

    @Column(name = "executed_at", nullable = false, updatable = false)
    private OffsetDateTime executedAt;

    protected InterventionExecutionLog() {
    }

    public InterventionExecutionLog(
            UUID merchantId,
            UUID recommendationId,
            UUID itemId,
            String idempotencyKey,
            String adapterCode,
            InterventionChannel channel,
            ExecutionProviderMode providerMode,
            ExecutionLogStatus executionStatus,
            String externalReferenceId,
            Map<String, Object> sanitizedMetadata,
            UUID executedByUserId,
            OffsetDateTime executedAt) {
        this.id = UUID.randomUUID();
        this.merchantId = merchantId;
        this.recommendationId = recommendationId;
        this.itemId = itemId;
        this.idempotencyKey = idempotencyKey;
        this.adapterCode = adapterCode;
        this.channel = channel;
        this.providerMode = providerMode;
        this.executionStatus = executionStatus;
        this.externalReferenceId = externalReferenceId;
        this.sanitizedMetadata = sanitizedMetadata != null
                ? new LinkedHashMap<>(sanitizedMetadata)
                : new LinkedHashMap<>();
        this.executedByUserId = executedByUserId;
        this.executedAt = executedAt != null ? executedAt : OffsetDateTime.now(ZoneOffset.UTC);
    }

    @PrePersist
    void onCreate() {
        if (this.id == null) {
            this.id = UUID.randomUUID();
        }
        if (this.executedAt == null) {
            this.executedAt = OffsetDateTime.now(ZoneOffset.UTC);
        }
    }

    public UUID getId() { return id; }
    public UUID getMerchantId() { return merchantId; }
    public UUID getRecommendationId() { return recommendationId; }
    public UUID getItemId() { return itemId; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public String getAdapterCode() { return adapterCode; }
    public InterventionChannel getChannel() { return channel; }
    public ExecutionProviderMode getProviderMode() { return providerMode; }
    public ExecutionLogStatus getExecutionStatus() { return executionStatus; }
    public String getExternalReferenceId() { return externalReferenceId; }
    public Map<String, Object> getSanitizedMetadata() { return sanitizedMetadata; }
    public UUID getExecutedByUserId() { return executedByUserId; }
    public OffsetDateTime getExecutedAt() { return executedAt; }
}
