package com.ordexa.intervention.entity;

import com.ordexa.customer.entity.Customer;
import com.ordexa.intervention.model.EvaluationStatus;
import com.ordexa.intervention.model.InterventionEnums.EvidenceCompleteness;
import com.ordexa.intervention.model.InterventionStatus;
import com.ordexa.order.entity.Order;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "intervention_recommendations")
public class InterventionRecommendation {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "merchant_id", nullable = false, updatable = false)
    private UUID merchantId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false, updatable = false)
    private Order order;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false, updatable = false)
    private Customer customer;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 40)
    private InterventionStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "evaluation_status", nullable = false, length = 48)
    private EvaluationStatus evaluationStatus;

    @Column(name = "ruleset_version", nullable = false, length = 48)
    private String rulesetVersion;

    @Column(name = "idempotency_fingerprint", nullable = false, length = 128)
    private String idempotencyFingerprint;

    @Column(name = "active_record", nullable = false)
    private boolean activeRecord = true;

    @Column(name = "rto_score")
    private Integer rtoScore;

    @Column(name = "rto_band", length = 24)
    private String rtoBand;

    @Column(name = "rto_reason_codes", length = 512)
    private String rtoReasonCodes;

    @Column(name = "rto_assessed_at")
    private OffsetDateTime rtoAssessedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "evidence_completeness", nullable = false, length = 24)
    private EvidenceCompleteness evidenceCompleteness;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "evidence_snapshot", nullable = false)
    private Map<String, Object> evidenceSnapshot = new LinkedHashMap<>();

    @Column(name = "superseded_by_id")
    private UUID supersededById;

    @Column(name = "evaluated_at", nullable = false)
    private OffsetDateTime evaluatedAt;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @OneToMany(mappedBy = "recommendation", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("rankOrder ASC")
    private List<InterventionRecommendationItem> items = new ArrayList<>();

    protected InterventionRecommendation() {
    }

    public InterventionRecommendation(
            UUID id,
            UUID merchantId,
            Order order,
            Customer customer,
            InterventionStatus status,
            EvaluationStatus evaluationStatus,
            String rulesetVersion,
            String idempotencyFingerprint,
            Integer rtoScore,
            String rtoBand,
            String rtoReasonCodes,
            OffsetDateTime rtoAssessedAt,
            EvidenceCompleteness evidenceCompleteness,
            Map<String, Object> evidenceSnapshot,
            OffsetDateTime evaluatedAt,
            OffsetDateTime expiresAt) {
        this.id = id != null ? id : UUID.randomUUID();
        this.merchantId = merchantId;
        this.order = order;
        this.customer = customer;
        this.status = status;
        this.evaluationStatus = evaluationStatus;
        this.rulesetVersion = rulesetVersion;
        this.idempotencyFingerprint = idempotencyFingerprint;
        this.activeRecord = true;
        this.rtoScore = rtoScore;
        this.rtoBand = rtoBand;
        this.rtoReasonCodes = rtoReasonCodes;
        this.rtoAssessedAt = rtoAssessedAt;
        this.evidenceCompleteness = evidenceCompleteness;
        this.evidenceSnapshot = evidenceSnapshot != null ? new LinkedHashMap<>(evidenceSnapshot) : new LinkedHashMap<>();
        this.evaluatedAt = evaluatedAt;
        this.expiresAt = expiresAt;
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PrePersist
    void onCreate() {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        if (this.id == null) {
            this.id = UUID.randomUUID();
        }
        if (this.createdAt == null) {
            this.createdAt = now;
        }
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = OffsetDateTime.now(ZoneOffset.UTC);
    }

    public void addItem(InterventionRecommendationItem item) {
        this.items.add(item);
    }

    public void markSupersededBy(UUID newRecommendationId) {
        this.activeRecord = false;
        this.supersededById = newRecommendationId;
        this.status = InterventionStatus.SUPERSEDED;
        for (InterventionRecommendationItem item : this.items) {
            if (!item.getStatus().isTerminal()) {
                item.setStatus(InterventionStatus.SUPERSEDED);
            }
        }
    }

    public void markExpiredIfPastDue(OffsetDateTime now) {
        if (now.isAfter(this.expiresAt) && !this.status.isTerminal()) {
            this.activeRecord = false;
            this.status = InterventionStatus.EXPIRED;
            for (InterventionRecommendationItem item : this.items) {
                if (!item.getStatus().isTerminal()) {
                    item.setStatus(InterventionStatus.EXPIRED);
                }
            }
        }
    }

    public UUID getId() { return id; }
    public UUID getMerchantId() { return merchantId; }
    public Order getOrder() { return order; }
    public Customer getCustomer() { return customer; }
    public InterventionStatus getStatus() { return status; }
    public void setStatus(InterventionStatus status) { this.status = status; }
    public EvaluationStatus getEvaluationStatus() { return evaluationStatus; }
    public String getRulesetVersion() { return rulesetVersion; }
    public String getIdempotencyFingerprint() { return idempotencyFingerprint; }
    public boolean isActiveRecord() { return activeRecord; }
    public void setActiveRecord(boolean activeRecord) { this.activeRecord = activeRecord; }
    public Integer getRtoScore() { return rtoScore; }
    public String getRtoBand() { return rtoBand; }
    public String getRtoReasonCodes() { return rtoReasonCodes; }
    public OffsetDateTime getRtoAssessedAt() { return rtoAssessedAt; }
    public EvidenceCompleteness getEvidenceCompleteness() { return evidenceCompleteness; }
    public Map<String, Object> getEvidenceSnapshot() { return evidenceSnapshot; }
    public UUID getSupersededById() { return supersededById; }
    public OffsetDateTime getEvaluatedAt() { return evaluatedAt; }
    public OffsetDateTime getExpiresAt() { return expiresAt; }
    public long getVersion() { return version; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public List<InterventionRecommendationItem> getItems() { return items; }
}
