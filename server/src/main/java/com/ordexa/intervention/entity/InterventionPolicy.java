package com.ordexa.intervention.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Entity
@Table(name = "intervention_policies")
public class InterventionPolicy {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "merchant_id", nullable = false, updatable = false, unique = true)
    private UUID merchantId;

    @Column(name = "enabled", nullable = false)
    private boolean enabled = true;

    @Column(name = "cod_confirmation_enabled", nullable = false)
    private boolean codConfirmationEnabled = true;

    @Column(name = "address_clarification_enabled", nullable = false)
    private boolean addressClarificationEnabled = true;

    @Column(name = "human_review_enabled", nullable = false)
    private boolean humanReviewEnabled = true;

    @Column(name = "partial_advance_enabled", nullable = false)
    private boolean partialAdvanceEnabled = false;

    @Column(name = "partial_advance_payment_capable", nullable = false)
    private boolean partialAdvancePaymentCapable = false;

    @Column(name = "partial_advance_min_order_value", nullable = false, precision = 14, scale = 2)
    private BigDecimal partialAdvanceMinOrderValue = new BigDecimal("2500.00");

    @Column(name = "cod_confirmation_min_order_value", nullable = false, precision = 14, scale = 2)
    private BigDecimal codConfirmationMinOrderValue = new BigDecimal("0.00");

    @Column(name = "enabled_channels", nullable = false, length = 128)
    private String enabledChannels = "VOICE_SANDBOX";

    @Column(name = "max_contacts_per_order", nullable = false)
    private int maxContactsPerOrder = 3;

    @Column(name = "max_contacts_per_customer_24h", nullable = false)
    private int maxContactsPerCustomer24h = 3;

    @Column(name = "min_hours_between_contacts", nullable = false)
    private int minHoursBetweenContacts = 2;

    @Column(name = "recommendation_ttl_hours", nullable = false)
    private int recommendationTtlHours = 24;

    @Column(name = "max_rto_assessment_age_minutes", nullable = false)
    private int maxRtoAssessmentAgeMinutes = 60;

    @Column(name = "require_approval_for_contact", nullable = false)
    private boolean requireApprovalForContact = true;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected InterventionPolicy() {
    }

    public InterventionPolicy(UUID merchantId) {
        this.id = UUID.randomUUID();
        this.merchantId = merchantId;
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
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public boolean isCodConfirmationEnabled() { return codConfirmationEnabled; }
    public void setCodConfirmationEnabled(boolean codConfirmationEnabled) { this.codConfirmationEnabled = codConfirmationEnabled; }
    public boolean isAddressClarificationEnabled() { return addressClarificationEnabled; }
    public void setAddressClarificationEnabled(boolean addressClarificationEnabled) { this.addressClarificationEnabled = addressClarificationEnabled; }
    public boolean isHumanReviewEnabled() { return humanReviewEnabled; }
    public void setHumanReviewEnabled(boolean humanReviewEnabled) { this.humanReviewEnabled = humanReviewEnabled; }
    public boolean isPartialAdvanceEnabled() { return partialAdvanceEnabled; }
    public void setPartialAdvanceEnabled(boolean partialAdvanceEnabled) { this.partialAdvanceEnabled = partialAdvanceEnabled; }
    public boolean isPartialAdvancePaymentCapable() { return partialAdvancePaymentCapable; }
    public void setPartialAdvancePaymentCapable(boolean partialAdvancePaymentCapable) { this.partialAdvancePaymentCapable = partialAdvancePaymentCapable; }
    public BigDecimal getPartialAdvanceMinOrderValue() { return partialAdvanceMinOrderValue; }
    public void setPartialAdvanceMinOrderValue(BigDecimal partialAdvanceMinOrderValue) { this.partialAdvanceMinOrderValue = partialAdvanceMinOrderValue; }
    public BigDecimal getCodConfirmationMinOrderValue() { return codConfirmationMinOrderValue; }
    public void setCodConfirmationMinOrderValue(BigDecimal codConfirmationMinOrderValue) { this.codConfirmationMinOrderValue = codConfirmationMinOrderValue; }
    public String getEnabledChannels() { return enabledChannels; }
    public void setEnabledChannels(String enabledChannels) { this.enabledChannels = enabledChannels; }
    public int getMaxContactsPerOrder() { return maxContactsPerOrder; }
    public void setMaxContactsPerOrder(int maxContactsPerOrder) { this.maxContactsPerOrder = maxContactsPerOrder; }
    public int getMaxContactsPerCustomer24h() { return maxContactsPerCustomer24h; }
    public void setMaxContactsPerCustomer24h(int maxContactsPerCustomer24h) { this.maxContactsPerCustomer24h = maxContactsPerCustomer24h; }
    public int getMinHoursBetweenContacts() { return minHoursBetweenContacts; }
    public void setMinHoursBetweenContacts(int minHoursBetweenContacts) { this.minHoursBetweenContacts = minHoursBetweenContacts; }
    public int getRecommendationTtlHours() { return recommendationTtlHours; }
    public void setRecommendationTtlHours(int recommendationTtlHours) { this.recommendationTtlHours = recommendationTtlHours; }
    public int getMaxRtoAssessmentAgeMinutes() { return maxRtoAssessmentAgeMinutes; }
    public void setMaxRtoAssessmentAgeMinutes(int maxRtoAssessmentAgeMinutes) { this.maxRtoAssessmentAgeMinutes = maxRtoAssessmentAgeMinutes; }
    public boolean isRequireApprovalForContact() { return requireApprovalForContact; }
    public void setRequireApprovalForContact(boolean requireApprovalForContact) { this.requireApprovalForContact = requireApprovalForContact; }
    public long getVersion() { return version; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
