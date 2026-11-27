package com.ordexa.intervention.entity;

import com.ordexa.intervention.model.InterventionEnums.ApprovalDecision;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Entity
@Table(name = "intervention_approvals")
public class InterventionApproval {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "merchant_id", nullable = false, updatable = false)
    private UUID merchantId;

    @Column(name = "recommendation_id", nullable = false, updatable = false)
    private UUID recommendationId;

    @Column(name = "item_id", nullable = false, updatable = false)
    private UUID itemId;

    @Column(name = "actor_user_id", nullable = false, updatable = false)
    private UUID actorUserId;

    @Column(name = "actor_role", nullable = false, length = 32)
    private String actorRole;

    @Enumerated(EnumType.STRING)
    @Column(name = "decision", nullable = false, length = 24)
    private ApprovalDecision decision;

    @Column(name = "note", length = 512)
    private String note;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected InterventionApproval() {
    }

    public InterventionApproval(
            UUID merchantId,
            UUID recommendationId,
            UUID itemId,
            UUID actorUserId,
            String actorRole,
            ApprovalDecision decision,
            String note,
            OffsetDateTime createdAt) {
        this.id = UUID.randomUUID();
        this.merchantId = merchantId;
        this.recommendationId = recommendationId;
        this.itemId = itemId;
        this.actorUserId = actorUserId;
        this.actorRole = actorRole;
        this.decision = decision;
        this.note = note;
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
    public UUID getRecommendationId() { return recommendationId; }
    public UUID getItemId() { return itemId; }
    public UUID getActorUserId() { return actorUserId; }
    public String getActorRole() { return actorRole; }
    public ApprovalDecision getDecision() { return decision; }
    public String getNote() { return note; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
