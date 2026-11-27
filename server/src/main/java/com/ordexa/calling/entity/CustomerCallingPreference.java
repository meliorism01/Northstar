package com.ordexa.calling.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Entity
@Table(name = "customer_calling_preferences")
public class CustomerCallingPreference {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "merchant_id", nullable = false, updatable = false)
    private UUID merchantId;

    @Column(name = "customer_id", nullable = false, updatable = false)
    private UUID customerId;

    @Column(name = "opted_out", nullable = false)
    private boolean optedOut = false;

    @Column(name = "opted_out_reason", length = 255)
    private String optedOutReason;

    @Column(name = "opted_out_at")
    private OffsetDateTime optedOutAt;

    @Column(name = "preferred_language", length = 16)
    private String preferredLanguage;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected CustomerCallingPreference() {
    }

    public CustomerCallingPreference(UUID merchantId, UUID customerId) {
        this.id = UUID.randomUUID();
        this.merchantId = merchantId;
        this.customerId = customerId;
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

    public void markOptedOut(String reason, OffsetDateTime when) {
        this.optedOut = true;
        this.optedOutReason = reason;
        this.optedOutAt = when;
    }

    public void clearOptOut() {
        this.optedOut = false;
        this.optedOutReason = null;
        this.optedOutAt = null;
    }

    public UUID getId() { return id; }
    public UUID getMerchantId() { return merchantId; }
    public UUID getCustomerId() { return customerId; }
    public boolean isOptedOut() { return optedOut; }
    public String getOptedOutReason() { return optedOutReason; }
    public OffsetDateTime getOptedOutAt() { return optedOutAt; }
    public String getPreferredLanguage() { return preferredLanguage; }
    public void setPreferredLanguage(String preferredLanguage) { this.preferredLanguage = preferredLanguage; }
}
