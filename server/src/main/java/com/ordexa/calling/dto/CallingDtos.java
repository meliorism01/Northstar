package com.ordexa.calling.dto;

import com.ordexa.calling.entity.CallAttemptStatus;
import com.ordexa.calling.entity.CallOutcome;
import com.ordexa.calling.entity.CallSessionStatus;
import com.ordexa.calling.entity.TranscriptSpeakerRole;
import com.ordexa.order.entity.OrderStatus;
import com.ordexa.order.entity.PaymentMethod;
import com.ordexa.risk.RtoRiskAssessmentDto;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public final class CallingDtos {

    private CallingDtos() {
    }

    public record CallingOverviewDto(
            long totalCodOrdersRequiringVerification,
            long callsQueuedOrScheduled,
            long callsInitiated,
            long callsCompleted,
            long confirmedOrders,
            long rejectedOrders,
            long unansweredCalls,
            long cancellationRequests,
            long escalatedCalls,
            long failedCalls,
            boolean inDndWindowNow,
            String activeProvider
    ) {}

    public record CallQueueItemDto(
            UUID sessionId,
            UUID orderId,
            String orderNumber,
            OrderStatus orderStatus,
            PaymentMethod paymentMethod,
            BigDecimal orderAmount,
            String currency,
            String primaryProduct,
            UUID customerId,
            String customerName,
            String maskedPhone,
            String phoneNumber,
            String language,
            int rtoRiskScore,
            String rtoRiskBand,
            CallSessionStatus status,
            CallOutcome outcome,
            int attemptCount,
            int maxAttempts,
            boolean doNotCallFurther,
            String recommendedAction,
            OffsetDateTime lastAttemptAt,
            OffsetDateTime nextAttemptAt,
            OffsetDateTime createdAt
    ) {}

    public record CallAttemptDto(
            UUID attemptId,
            int attemptNumber,
            String provider,
            String providerCallId,
            String roomName,
            CallAttemptStatus status,
            CallOutcome outcome,
            String language,
            Integer durationSeconds,
            String recordingUrl,
            boolean consentDisclosed,
            String failureReason,
            OffsetDateTime startedAt,
            OffsetDateTime answeredAt,
            OffsetDateTime endedAt
    ) {}

    public record CallTranscriptTurnDto(
            UUID transcriptId,
            UUID attemptId,
            int turnIndex,
            TranscriptSpeakerRole speakerRole,
            String utteranceText,
            String language,
            BigDecimal confidence,
            OffsetDateTime occurredAt
    ) {}

    public record CallEventDto(
            UUID eventId,
            UUID attemptId,
            String eventType,
            String actor,
            String details,
            OffsetDateTime createdAt
    ) {}

    public record CallSessionDetailDto(
            CallQueueItemDto session,
            String shippingAddress,
            List<OrderLineBriefDto> orderItems,
            String aiSummary,
            String customerIntent,
            String lastError,
            boolean customerOptedOut,
            RtoRiskAssessmentDto rtoAssessment,
            List<CallAttemptDto> attempts,
            List<CallTranscriptTurnDto> transcript,
            List<CallEventDto> timeline
    ) {}

    public record OrderLineBriefDto(
            String productName,
            String sku,
            int quantity,
            BigDecimal unitPrice,
            BigDecimal totalPrice
    ) {}

    public record CallingConfigurationDto(
            UUID merchantId,
            boolean enabled,
            String provider,
            String defaultLanguage,
            List<String> supportedLanguages,
            int maxAttempts,
            int retryBackoffMinutes1,
            int retryBackoffMinutes2,
            int callTimeoutSeconds,
            int dndStartHourIst,
            int dndEndHourIst,
            int dndResumeMinuteIst,
            boolean autoConfirmOrderOnYes,
            boolean autoCancelOrderOnRequest
    ) {}

    public record UpdateCallingConfigurationRequest(
            @NotNull Boolean enabled,
            @NotBlank String provider,
            @NotBlank String defaultLanguage,
            @NotBlank String supportedLanguages,
            @NotNull @Min(1) @Max(10) Integer maxAttempts,
            @NotNull @Min(1) @Max(1440) Integer retryBackoffMinutes1,
            @NotNull @Min(1) @Max(2880) Integer retryBackoffMinutes2,
            @NotNull @Min(15) @Max(600) Integer callTimeoutSeconds,
            @NotNull @Min(18) @Max(23) Integer dndStartHourIst,
            @NotNull @Min(5) @Max(12) Integer dndEndHourIst,
            @NotNull Boolean autoConfirmOrderOnYes,
            @NotNull Boolean autoCancelOrderOnRequest
    ) {}

    public record ManualCallActionRequest(
            String reason,
            String preferredLanguage,
            Boolean optOutCustomer
    ) {}

    public record SimulateCallOutcomeRequest(
            @NotNull CallOutcome outcome,
            Integer durationSeconds,
            String language,
            String customerUtterance,
            String summaryOverride,
            Boolean customerOptOut
    ) {}

    public record TranscriptTurnPayload(
            int turnIndex,
            String role,
            String text,
            String language,
            BigDecimal confidence,
            OffsetDateTime occurredAt
    ) {}

    public record ProviderWebhookPayload(
            @NotBlank String eventId,
            @NotBlank String eventType,
            UUID callSessionId,
            UUID callAttemptId,
            String providerCallId,
            String roomName,
            CallOutcome outcome,
            Integer durationSeconds,
            String recordingUrl,
            String aiSummary,
            String customerIntent,
            Boolean customerOptOut,
            String failureReason,
            List<TranscriptTurnPayload> transcriptTurns
    ) {}

    public record SyncEligibleOrdersResponse(
            int newlyEnrolledCount,
            int alreadyEnrolledCount,
            int dispatchedImmediatelyCount
    ) {}
}
