package com.ordexa.calling.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Entity
@Table(name = "call_attempts")
public class CallAttempt {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "merchant_id", nullable = false, updatable = false)
    private UUID merchantId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "call_session_id", nullable = false, updatable = false)
    private CallSession callSession;

    @Column(name = "attempt_number", nullable = false, updatable = false)
    private int attemptNumber;

    @Column(name = "idempotency_key", nullable = false, updatable = false, unique = true, length = 128)
    private String idempotencyKey;

    @Column(name = "provider", nullable = false, length = 32)
    private String provider;

    @Column(name = "provider_call_id", length = 128)
    private String providerCallId;

    @Column(name = "room_name", length = 160)
    private String roomName;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private CallAttemptStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "outcome", length = 32)
    private CallOutcome outcome;

    @Column(name = "language", nullable = false, length = 16)
    private String language;

    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    @Column(name = "recording_url", length = 512)
    private String recordingUrl;

    @Column(name = "consent_disclosed", nullable = false)
    private boolean consentDisclosed = true;

    @Column(name = "failure_reason", length = 512)
    private String failureReason;

    @Column(name = "started_at", nullable = false, updatable = false)
    private OffsetDateTime startedAt;

    @Column(name = "answered_at")
    private OffsetDateTime answeredAt;

    @Column(name = "ended_at")
    private OffsetDateTime endedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected CallAttempt() {
    }

    public CallAttempt(
            UUID id,
            UUID merchantId,
            CallSession callSession,
            int attemptNumber,
            String idempotencyKey,
            String provider,
            String providerCallId,
            String roomName,
            CallAttemptStatus status,
            String language,
            OffsetDateTime startedAt) {
        this.id = id != null ? id : UUID.randomUUID();
        this.merchantId = merchantId;
        this.callSession = callSession;
        this.attemptNumber = attemptNumber;
        this.idempotencyKey = idempotencyKey;
        this.provider = provider;
        this.providerCallId = providerCallId;
        this.roomName = roomName;
        this.status = status;
        this.language = language;
        OffsetDateTime ts = startedAt != null ? startedAt : OffsetDateTime.now(ZoneOffset.UTC);
        this.startedAt = ts;
        this.createdAt = ts;
    }

    @PrePersist
    void onCreate() {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        if (this.id == null) {
            this.id = UUID.randomUUID();
        }
        if (this.startedAt == null) {
            this.startedAt = now;
        }
        if (this.createdAt == null) {
            this.createdAt = now;
        }
    }

    public UUID getId() { return id; }
    public UUID getMerchantId() { return merchantId; }
    public CallSession getCallSession() { return callSession; }
    public int getAttemptNumber() { return attemptNumber; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public String getProvider() { return provider; }
    public String getProviderCallId() { return providerCallId; }
    public void setProviderCallId(String providerCallId) { this.providerCallId = providerCallId; }
    public String getRoomName() { return roomName; }
    public void setRoomName(String roomName) { this.roomName = roomName; }
    public CallAttemptStatus getStatus() { return status; }
    public void setStatus(CallAttemptStatus status) { this.status = status; }
    public CallOutcome getOutcome() { return outcome; }
    public void setOutcome(CallOutcome outcome) { this.outcome = outcome; }
    public String getLanguage() { return language; }
    public Integer getDurationSeconds() { return durationSeconds; }
    public void setDurationSeconds(Integer durationSeconds) { this.durationSeconds = durationSeconds; }
    public String getRecordingUrl() { return recordingUrl; }
    public void setRecordingUrl(String recordingUrl) { this.recordingUrl = recordingUrl; }
    public boolean isConsentDisclosed() { return consentDisclosed; }
    public void setConsentDisclosed(boolean consentDisclosed) { this.consentDisclosed = consentDisclosed; }
    public String getFailureReason() { return failureReason; }
    public void setFailureReason(String failureReason) { this.failureReason = failureReason; }
    public OffsetDateTime getStartedAt() { return startedAt; }
    public OffsetDateTime getAnsweredAt() { return answeredAt; }
    public void setAnsweredAt(OffsetDateTime answeredAt) { this.answeredAt = answeredAt; }
    public OffsetDateTime getEndedAt() { return endedAt; }
    public void setEndedAt(OffsetDateTime endedAt) { this.endedAt = endedAt; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
