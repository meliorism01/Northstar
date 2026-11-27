package com.ordexa.calling.entity;

import com.ordexa.customer.entity.Customer;
import com.ordexa.order.entity.Order;
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
@Table(name = "call_sessions")
public class CallSession {

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

    @Column(name = "idempotency_key", nullable = false, updatable = false, unique = true, length = 128)
    private String idempotencyKey;

    @Column(name = "phone_number", nullable = false, length = 24)
    private String phoneNumber;

    @Column(name = "language", nullable = false, length = 16)
    private String language;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private CallSessionStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "final_outcome", length = 32)
    private CallOutcome finalOutcome;

    @Column(name = "attempt_count", nullable = false)
    private int attemptCount = 0;

    @Column(name = "max_attempts", nullable = false)
    private int maxAttempts = 3;

    @Column(name = "do_not_call_further", nullable = false)
    private boolean doNotCallFurther = false;

    @Column(name = "rto_risk_score_snapshot", nullable = false)
    private int rtoRiskScoreSnapshot = 0;

    @Column(name = "rto_risk_band_snapshot", nullable = false, length = 16)
    private String rtoRiskBandSnapshot = "LOW";

    @Column(name = "updated_rto_risk_score")
    private Integer updatedRtoRiskScore;

    @Column(name = "updated_rto_risk_band", length = 16)
    private String updatedRtoRiskBand;

    @Column(name = "ai_summary", length = 1024)
    private String aiSummary;

    @Column(name = "customer_intent", length = 255)
    private String customerIntent;

    @Column(name = "recommended_action", length = 255)
    private String recommendedAction;

    @Column(name = "last_error", length = 512)
    private String lastError;

    @Column(name = "last_attempt_at")
    private OffsetDateTime lastAttemptAt;

    @Column(name = "next_attempt_at")
    private OffsetDateTime nextAttemptAt;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected CallSession() {
    }

    public CallSession(
            UUID id,
            UUID merchantId,
            Order order,
            Customer customer,
            String idempotencyKey,
            String phoneNumber,
            String language,
            CallSessionStatus status,
            int maxAttempts,
            int rtoRiskScoreSnapshot,
            String rtoRiskBandSnapshot,
            OffsetDateTime nextAttemptAt) {
        this.id = id != null ? id : UUID.randomUUID();
        this.merchantId = merchantId;
        this.order = order;
        this.customer = customer;
        this.idempotencyKey = idempotencyKey;
        this.phoneNumber = phoneNumber;
        this.language = language;
        this.status = status;
        this.maxAttempts = maxAttempts;
        this.rtoRiskScoreSnapshot = rtoRiskScoreSnapshot;
        this.rtoRiskBandSnapshot = rtoRiskBandSnapshot != null ? rtoRiskBandSnapshot : "LOW";
        this.nextAttemptAt = nextAttemptAt;
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
    public Order getOrder() { return order; }
    public Customer getCustomer() { return customer; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }
    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }
    public CallSessionStatus getStatus() { return status; }
    public void setStatus(CallSessionStatus status) { this.status = status; }
    public CallOutcome getFinalOutcome() { return finalOutcome; }
    public void setFinalOutcome(CallOutcome finalOutcome) { this.finalOutcome = finalOutcome; }
    public int getAttemptCount() { return attemptCount; }
    public void setAttemptCount(int attemptCount) { this.attemptCount = attemptCount; }
    public int getMaxAttempts() { return maxAttempts; }
    public void setMaxAttempts(int maxAttempts) { this.maxAttempts = maxAttempts; }
    public boolean isDoNotCallFurther() { return doNotCallFurther; }
    public void setDoNotCallFurther(boolean doNotCallFurther) { this.doNotCallFurther = doNotCallFurther; }
    public int getRtoRiskScoreSnapshot() { return rtoRiskScoreSnapshot; }
    public String getRtoRiskBandSnapshot() { return rtoRiskBandSnapshot; }
    public Integer getUpdatedRtoRiskScore() { return updatedRtoRiskScore; }
    public void setUpdatedRtoRiskScore(Integer updatedRtoRiskScore) { this.updatedRtoRiskScore = updatedRtoRiskScore; }
    public String getUpdatedRtoRiskBand() { return updatedRtoRiskBand; }
    public void setUpdatedRtoRiskBand(String updatedRtoRiskBand) { this.updatedRtoRiskBand = updatedRtoRiskBand; }
    public String getAiSummary() { return aiSummary; }
    public void setAiSummary(String aiSummary) { this.aiSummary = aiSummary; }
    public String getCustomerIntent() { return customerIntent; }
    public void setCustomerIntent(String customerIntent) { this.customerIntent = customerIntent; }
    public String getRecommendedAction() { return recommendedAction; }
    public void setRecommendedAction(String recommendedAction) { this.recommendedAction = recommendedAction; }
    public String getLastError() { return lastError; }
    public void setLastError(String lastError) { this.lastError = lastError; }
    public OffsetDateTime getLastAttemptAt() { return lastAttemptAt; }
    public void setLastAttemptAt(OffsetDateTime lastAttemptAt) { this.lastAttemptAt = lastAttemptAt; }
    public OffsetDateTime getNextAttemptAt() { return nextAttemptAt; }
    public void setNextAttemptAt(OffsetDateTime nextAttemptAt) { this.nextAttemptAt = nextAttemptAt; }
    public OffsetDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(OffsetDateTime completedAt) { this.completedAt = completedAt; }
    public long getVersion() { return version; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
