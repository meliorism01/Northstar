package com.ordexa.intervention.entity;

import com.ordexa.intervention.model.InterventionEnums.InterventionChannel;
import com.ordexa.intervention.model.InterventionEnums.InterventionItemRole;
import com.ordexa.intervention.model.InterventionPriority;
import com.ordexa.intervention.model.InterventionStatus;
import com.ordexa.intervention.model.InterventionType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Entity
@Table(name = "intervention_recommendation_items")
public class InterventionRecommendationItem {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "merchant_id", nullable = false, updatable = false)
    private UUID merchantId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recommendation_id", nullable = false, updatable = false)
    private InterventionRecommendation recommendation;

    @Enumerated(EnumType.STRING)
    @Column(name = "intervention_type", nullable = false, length = 40)
    private InterventionType interventionType;

    @Enumerated(EnumType.STRING)
    @Column(name = "item_role", nullable = false, length = 24)
    private InterventionItemRole itemRole;

    @Column(name = "rank_order", nullable = false)
    private int rankOrder;

    @Enumerated(EnumType.STRING)
    @Column(name = "priority", nullable = false, length = 24)
    private InterventionPriority priority;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 40)
    private InterventionStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "proposed_channel", nullable = false, length = 32)
    private InterventionChannel proposedChannel;

    @Column(name = "triggered_rule_ids", nullable = false, length = 255)
    private String triggeredRuleIds;

    @Column(name = "reason_codes", nullable = false, length = 512)
    private String reasonCodes;

    @Column(name = "explanation", nullable = false, length = 1024)
    private String explanation;

    @Column(name = "required_evidence", length = 512)
    private String requiredEvidence;

    @Column(name = "approval_required", nullable = false)
    private boolean approvalRequired;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected InterventionRecommendationItem() {
    }

    public InterventionRecommendationItem(
            UUID id,
            UUID merchantId,
            InterventionRecommendation recommendation,
            InterventionType interventionType,
            InterventionItemRole itemRole,
            int rankOrder,
            InterventionPriority priority,
            InterventionStatus status,
            InterventionChannel proposedChannel,
            String triggeredRuleIds,
            String reasonCodes,
            String explanation,
            String requiredEvidence,
            boolean approvalRequired) {
        this.id = id != null ? id : UUID.randomUUID();
        this.merchantId = merchantId;
        this.recommendation = recommendation;
        this.interventionType = interventionType;
        this.itemRole = itemRole;
        this.rankOrder = rankOrder;
        this.priority = priority;
        this.status = status;
        this.proposedChannel = proposedChannel;
        this.triggeredRuleIds = triggeredRuleIds;
        this.reasonCodes = reasonCodes;
        this.explanation = explanation;
        this.requiredEvidence = requiredEvidence;
        this.approvalRequired = approvalRequired;
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

    public UUID getId() { return id; }
    public UUID getMerchantId() { return merchantId; }
    public InterventionRecommendation getRecommendation() { return recommendation; }
    public InterventionType getInterventionType() { return interventionType; }
    public InterventionItemRole getItemRole() { return itemRole; }
    public int getRankOrder() { return rankOrder; }
    public InterventionPriority getPriority() { return priority; }
    public InterventionStatus getStatus() { return status; }
    public void setStatus(InterventionStatus status) { this.status = status; }
    public InterventionChannel getProposedChannel() { return proposedChannel; }
    public String getTriggeredRuleIds() { return triggeredRuleIds; }
    public String getReasonCodes() { return reasonCodes; }
    public String getExplanation() { return explanation; }
    public String getRequiredEvidence() { return requiredEvidence; }
    public boolean isApprovalRequired() { return approvalRequired; }
    public long getVersion() { return version; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
