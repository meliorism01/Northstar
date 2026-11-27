package com.ordexa.intervention.entity;

import com.ordexa.intervention.model.InterventionEnums.ConsentStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Entity
@Table(name = "intervention_customer_consents")
public class InterventionCustomerConsent {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "merchant_id", nullable = false, updatable = false)
    private UUID merchantId;

    @Column(name = "customer_id", nullable = false, updatable = false)
    private UUID customerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "consent_status", nullable = false, length = 24)
    private ConsentStatus consentStatus = ConsentStatus.UNKNOWN;

    @Column(name = "permitted_channels", nullable = false, length = 128)
    private String permittedChannels = "VOICE_SANDBOX";

    @Column(name = "consent_source", nullable = false, length = 64)
    private String consentSource = "UNSPECIFIED";

    @Column(name = "recorded_by_user")
    private UUID recordedByUser;

    @Column(name = "recorded_at", nullable = false)
    private OffsetDateTime recordedAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected InterventionCustomerConsent() {
    }

    public InterventionCustomerConsent(
            UUID merchantId,
            UUID customerId,
            ConsentStatus consentStatus,
            String permittedChannels,
            String consentSource,
            UUID recordedByUser,
            OffsetDateTime now) {
        this.id = UUID.randomUUID();
        this.merchantId = merchantId;
        this.customerId = customerId;
        this.consentStatus = consentStatus != null ? consentStatus : ConsentStatus.UNKNOWN;
        this.permittedChannels = (permittedChannels != null && !permittedChannels.isBlank())
                ? permittedChannels.trim()
                : "VOICE_SANDBOX";
        this.consentSource = (consentSource != null && !consentSource.isBlank())
                ? consentSource.trim()
                : "OPERATOR_VERIFIED";
        this.recordedByUser = recordedByUser;
        OffsetDateTime ts = now != null ? now : OffsetDateTime.now(ZoneOffset.UTC);
        this.recordedAt = ts;
        this.updatedAt = ts;
    }

    @PrePersist
    void onCreate() {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        if (this.id == null) {
            this.id = UUID.randomUUID();
        }
        if (this.recordedAt == null) {
            this.recordedAt = now;
        }
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = OffsetDateTime.now(ZoneOffset.UTC);
    }

    public void updateConsent(
            ConsentStatus consentStatus,
            String permittedChannels,
            String consentSource,
            UUID actorUserId,
            OffsetDateTime when) {
        this.consentStatus = consentStatus != null ? consentStatus : ConsentStatus.UNKNOWN;
        if (permittedChannels != null && !permittedChannels.isBlank()) {
            this.permittedChannels = permittedChannels.trim();
        }
        if (consentSource != null && !consentSource.isBlank()) {
            this.consentSource = consentSource.trim();
        }
        this.recordedByUser = actorUserId;
        this.recordedAt = when != null ? when : OffsetDateTime.now(ZoneOffset.UTC);
    }

    public UUID getId() { return id; }
    public UUID getMerchantId() { return merchantId; }
    public UUID getCustomerId() { return customerId; }
    public ConsentStatus getConsentStatus() { return consentStatus; }
    public String getPermittedChannels() { return permittedChannels; }
    public String getConsentSource() { return consentSource; }
    public UUID getRecordedByUser() { return recordedByUser; }
    public OffsetDateTime getRecordedAt() { return recordedAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
