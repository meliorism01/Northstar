package com.ordexa.calling.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Entity
@Table(name = "call_transcripts")
public class CallTranscript {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "merchant_id", nullable = false, updatable = false)
    private UUID merchantId;

    @Column(name = "call_session_id", nullable = false, updatable = false)
    private UUID callSessionId;

    @Column(name = "call_attempt_id", nullable = false, updatable = false)
    private UUID callAttemptId;

    @Column(name = "turn_index", nullable = false, updatable = false)
    private int turnIndex;

    @Enumerated(EnumType.STRING)
    @Column(name = "speaker_role", nullable = false, updatable = false, length = 24)
    private TranscriptSpeakerRole speakerRole;

    @Column(name = "utterance_text", nullable = false, updatable = false, length = 2048)
    private String utteranceText;

    @Column(name = "language", updatable = false, length = 16)
    private String language;

    @Column(name = "confidence", updatable = false, precision = 5, scale = 4)
    private BigDecimal confidence;

    @Column(name = "occurred_at", nullable = false, updatable = false)
    private OffsetDateTime occurredAt;

    protected CallTranscript() {
    }

    public CallTranscript(
            UUID id,
            UUID merchantId,
            UUID callSessionId,
            UUID callAttemptId,
            int turnIndex,
            TranscriptSpeakerRole speakerRole,
            String utteranceText,
            String language,
            BigDecimal confidence,
            OffsetDateTime occurredAt) {
        this.id = id != null ? id : UUID.randomUUID();
        this.merchantId = merchantId;
        this.callSessionId = callSessionId;
        this.callAttemptId = callAttemptId;
        this.turnIndex = turnIndex;
        this.speakerRole = speakerRole;
        this.utteranceText = utteranceText != null && utteranceText.length() > 2048
                ? utteranceText.substring(0, 2048)
                : utteranceText;
        this.language = language;
        this.confidence = confidence;
        this.occurredAt = occurredAt != null ? occurredAt : OffsetDateTime.now(ZoneOffset.UTC);
    }

    @PrePersist
    void onCreate() {
        if (this.id == null) {
            this.id = UUID.randomUUID();
        }
        if (this.occurredAt == null) {
            this.occurredAt = OffsetDateTime.now(ZoneOffset.UTC);
        }
    }

    public UUID getId() { return id; }
    public UUID getMerchantId() { return merchantId; }
    public UUID getCallSessionId() { return callSessionId; }
    public UUID getCallAttemptId() { return callAttemptId; }
    public int getTurnIndex() { return turnIndex; }
    public TranscriptSpeakerRole getSpeakerRole() { return speakerRole; }
    public String getUtteranceText() { return utteranceText; }
    public String getLanguage() { return language; }
    public BigDecimal getConfidence() { return confidence; }
    public OffsetDateTime getOccurredAt() { return occurredAt; }
}
