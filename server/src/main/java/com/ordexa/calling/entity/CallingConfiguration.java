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
@Table(name = "calling_configurations")
public class CallingConfiguration {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "merchant_id", nullable = false, updatable = false, unique = true)
    private UUID merchantId;

    @Column(name = "enabled", nullable = false)
    private boolean enabled = true;

    @Column(name = "provider", nullable = false, length = 32)
    private String provider = "SANDBOX";

    @Column(name = "default_language", nullable = false, length = 16)
    private String defaultLanguage = "hi-IN";

    @Column(name = "supported_languages", nullable = false, length = 128)
    private String supportedLanguages = "hi-IN,en-IN";

    @Column(name = "max_attempts", nullable = false)
    private int maxAttempts = 3;

    @Column(name = "retry_backoff_minutes_1", nullable = false)
    private int retryBackoffMinutes1 = 30;

    @Column(name = "retry_backoff_minutes_2", nullable = false)
    private int retryBackoffMinutes2 = 120;

    @Column(name = "call_timeout_seconds", nullable = false)
    private int callTimeoutSeconds = 90;

    @Column(name = "dnd_start_hour_ist", nullable = false)
    private int dndStartHourIst = 21;

    @Column(name = "dnd_end_hour_ist", nullable = false)
    private int dndEndHourIst = 9;

    @Column(name = "dnd_resume_minute_ist", nullable = false)
    private int dndResumeMinuteIst = 5;

    @Column(name = "auto_confirm_order_on_yes", nullable = false)
    private boolean autoConfirmOrderOnYes = true;

    @Column(name = "auto_cancel_order_on_request", nullable = false)
    private boolean autoCancelOrderOnRequest = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected CallingConfiguration() {
    }

    public CallingConfiguration(UUID merchantId, String defaultProvider) {
        this.id = UUID.randomUUID();
        this.merchantId = merchantId;
        this.provider = (defaultProvider != null && !defaultProvider.isBlank()) ? defaultProvider : "SANDBOX";
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
    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public String getDefaultLanguage() { return defaultLanguage; }
    public void setDefaultLanguage(String defaultLanguage) { this.defaultLanguage = defaultLanguage; }
    public String getSupportedLanguages() { return supportedLanguages; }
    public void setSupportedLanguages(String supportedLanguages) { this.supportedLanguages = supportedLanguages; }
    public int getMaxAttempts() { return maxAttempts; }
    public void setMaxAttempts(int maxAttempts) { this.maxAttempts = maxAttempts; }
    public int getRetryBackoffMinutes1() { return retryBackoffMinutes1; }
    public void setRetryBackoffMinutes1(int retryBackoffMinutes1) { this.retryBackoffMinutes1 = retryBackoffMinutes1; }
    public int getRetryBackoffMinutes2() { return retryBackoffMinutes2; }
    public void setRetryBackoffMinutes2(int retryBackoffMinutes2) { this.retryBackoffMinutes2 = retryBackoffMinutes2; }
    public int getCallTimeoutSeconds() { return callTimeoutSeconds; }
    public void setCallTimeoutSeconds(int callTimeoutSeconds) { this.callTimeoutSeconds = callTimeoutSeconds; }
    public int getDndStartHourIst() { return dndStartHourIst; }
    public void setDndStartHourIst(int dndStartHourIst) { this.dndStartHourIst = dndStartHourIst; }
    public int getDndEndHourIst() { return dndEndHourIst; }
    public void setDndEndHourIst(int dndEndHourIst) { this.dndEndHourIst = dndEndHourIst; }
    public int getDndResumeMinuteIst() { return dndResumeMinuteIst; }
    public void setDndResumeMinuteIst(int dndResumeMinuteIst) { this.dndResumeMinuteIst = dndResumeMinuteIst; }
    public boolean isAutoConfirmOrderOnYes() { return autoConfirmOrderOnYes; }
    public void setAutoConfirmOrderOnYes(boolean autoConfirmOrderOnYes) { this.autoConfirmOrderOnYes = autoConfirmOrderOnYes; }
    public boolean isAutoCancelOrderOnRequest() { return autoCancelOrderOnRequest; }
    public void setAutoCancelOrderOnRequest(boolean autoCancelOrderOnRequest) { this.autoCancelOrderOnRequest = autoCancelOrderOnRequest; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
