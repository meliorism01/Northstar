package com.ordexa.intervention.dto;

import com.ordexa.intervention.model.EvaluationStatus;
import com.ordexa.intervention.model.InterventionEnums.ApprovalDecision;
import com.ordexa.intervention.model.InterventionEnums.ConsentStatus;
import com.ordexa.intervention.model.InterventionEnums.EvidenceCompleteness;
import com.ordexa.intervention.model.InterventionEnums.ExecutionLogStatus;
import com.ordexa.intervention.model.InterventionEnums.ExecutionProviderMode;
import com.ordexa.intervention.model.InterventionEnums.InterventionChannel;
import com.ordexa.intervention.model.InterventionEnums.InterventionItemRole;
import com.ordexa.intervention.model.InterventionEnums.InterventionOutcomeType;
import com.ordexa.intervention.model.InterventionPriority;
import com.ordexa.intervention.model.InterventionStatus;
import com.ordexa.intervention.model.InterventionType;
import com.ordexa.order.entity.OrderStatus;
import com.ordexa.order.entity.PaymentMethod;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Typed DTO contracts for NBIE.
 *
 * Authority Invariant:
 *   - Client requests never supply trusted merchantId, risk score, consent, or customer history.
 *   - Output contracts contain NO final order decision field.
 *   - {@code approvalRequired} means authorization to perform an intervention action ONLY,
 *     never approval of the order.
 */
public final class InterventionDtos {

    private InterventionDtos() {
    }

    public record RiskSnapshotDto(
            Integer score,
            String band,
            Integer behaviouralPoints,
            Integer orderPoints,
            Integer callingOutcomePoints,
            Integer historicalConfirmationPoints,
            List<String> reasonCodes,
            OffsetDateTime assessedAt
    ) {
    }

    public record RecommendedActionDto(
            UUID itemId,
            InterventionItemRole role,
            int rankOrder,
            InterventionType type,
            InterventionPriority priority,
            InterventionStatus status,
            InterventionChannel proposedChannel,
            List<String> triggeredRuleIds,
            List<String> reasonCodes,
            String explanation,
            List<String> requiredEvidence,
            boolean approvalRequired
    ) {
    }

    public record RecommendationResponseDto(
            UUID recommendationId,
            UUID orderUuid,
            String orderId,
            OrderStatus currentOrderStatus,
            PaymentMethod paymentMethod,
            BigDecimal orderValue,
            String currency,
            UUID customerId,
            String customerName,
            String maskedPhone,
            InterventionStatus status,
            EvaluationStatus evaluationStatus,
            RiskSnapshotDto riskSnapshot,
            RecommendedActionDto primaryRecommendation,
            List<RecommendedActionDto> secondaryRecommendations,
            EvidenceCompleteness evidenceCompleteness,
            Map<String, Object> evidenceSnapshot,
            String rulesetVersion,
            String authorityNotice,
            boolean activeRecord,
            OffsetDateTime evaluatedAt,
            OffsetDateTime expiresAt
    ) {
    }

    public record RecommendationDetailDto(
            RecommendationResponseDto recommendation,
            List<ApprovalHistoryDto> approvals,
            List<ExecutionLogDto> executions,
            List<OutcomeRecordDto> outcomes,
            List<AuditEventDto> auditTrail
    ) {
    }

    public record QueueItemDto(
            UUID recommendationId,
            UUID orderUuid,
            String orderNumber,
            OrderStatus currentOrderStatus,
            PaymentMethod paymentMethod,
            BigDecimal orderValue,
            String currency,
            UUID customerId,
            String customerName,
            String maskedPhone,
            InterventionStatus status,
            EvaluationStatus evaluationStatus,
            Integer rtoScore,
            String rtoBand,
            UUID primaryItemId,
            InterventionType primaryType,
            InterventionPriority primaryPriority,
            InterventionStatus primaryItemStatus,
            boolean approvalRequired,
            EvidenceCompleteness evidenceCompleteness,
            String rulesetVersion,
            OffsetDateTime evaluatedAt,
            OffsetDateTime expiresAt
    ) {
    }

    public record InterventionOverviewDto(
            long activeRecommendations,
            long awaitingActionApproval,
            long awaitingExecutionOrOutcome,
            long completedRecommendations,
            long highPriorityActive,
            String activeRulesetVersion,
            boolean sandboxOnlyMode
    ) {
    }

    public record ApprovalHistoryDto(
            UUID approvalId,
            UUID itemId,
            UUID actorUserId,
            String actorRole,
            ApprovalDecision decision,
            String note,
            OffsetDateTime createdAt
    ) {
    }

    public record ExecutionLogDto(
            UUID executionId,
            UUID itemId,
            String idempotencyKey,
            String adapterCode,
            InterventionChannel channel,
            ExecutionProviderMode providerMode,
            ExecutionLogStatus executionStatus,
            String externalReferenceId,
            Map<String, Object> sanitizedMetadata,
            OffsetDateTime executedAt
    ) {
    }

    public record OutcomeRecordDto(
            UUID outcomeId,
            UUID itemId,
            InterventionOutcomeType outcomeType,
            String outcomeSource,
            boolean verifiedResponse,
            Map<String, Object> minimizedPayload,
            OffsetDateTime recordedAt
    ) {
    }

    public record AuditEventDto(
            UUID eventId,
            UUID itemId,
            String actorLabel,
            String eventType,
            String rulesetVersion,
            String correlationId,
            String summary,
            Map<String, Object> metadata,
            OffsetDateTime createdAt
    ) {
    }

    public record ActionDecisionRequest(
            @Size(max = 500, message = "Note must be 500 characters or fewer")
            String note
    ) {
    }

    public record ExecuteInterventionRequest(
            @Size(max = 120, message = "Idempotency key must be 120 characters or fewer")
            String idempotencyKey,
            @Size(max = 400, message = "Operator note must be 400 characters or fewer")
            String note
    ) {
    }

    public record RecordOutcomeRequest(
            @NotNull(message = "Outcome type is required")
            InterventionOutcomeType outcomeType,
            @Size(max = 120, message = "Idempotency key must be 120 characters or fewer")
            String idempotencyKey,
            @Size(max = 48, message = "Outcome source must be 48 characters or fewer")
            String outcomeSource,
            @Size(max = 400, message = "Summary note must be 400 characters or fewer")
            String summaryNote,
            List<String> resolvedFields,
            Boolean triggerReEvaluation
    ) {
    }

    public record InterventionPolicyDto(
            UUID merchantId,
            boolean enabled,
            boolean codConfirmationEnabled,
            boolean addressClarificationEnabled,
            boolean humanReviewEnabled,
            boolean partialAdvanceEnabled,
            boolean partialAdvancePaymentCapable,
            BigDecimal partialAdvanceMinOrderValue,
            BigDecimal codConfirmationMinOrderValue,
            List<String> enabledChannels,
            int maxContactsPerOrder,
            int maxContactsPerCustomer24h,
            int minHoursBetweenContacts,
            int recommendationTtlHours,
            int maxRtoAssessmentAgeMinutes,
            boolean requireApprovalForContact
    ) {
    }

    public record UpdateInterventionPolicyRequest(
            boolean enabled,
            boolean codConfirmationEnabled,
            boolean addressClarificationEnabled,
            boolean humanReviewEnabled,
            boolean partialAdvanceEnabled,
            boolean partialAdvancePaymentCapable,
            @NotNull @PositiveOrZero BigDecimal partialAdvanceMinOrderValue,
            @NotNull @PositiveOrZero BigDecimal codConfirmationMinOrderValue,
            @NotNull List<String> enabledChannels,
            @Min(0) @Max(10) int maxContactsPerOrder,
            @Min(0) @Max(20) int maxContactsPerCustomer24h,
            @Min(0) @Max(72) int minHoursBetweenContacts,
            @Min(1) @Max(168) int recommendationTtlHours,
            @Min(1) @Max(1440) int maxRtoAssessmentAgeMinutes,
            boolean requireApprovalForContact
    ) {
    }

    public record CustomerConsentDto(
            UUID customerId,
            ConsentStatus effectiveConsentStatus,
            boolean dncOptedOut,
            List<String> permittedChannels,
            String consentSource,
            OffsetDateTime recordedAt
    ) {
    }

    public record UpdateCustomerConsentRequest(
            @NotNull(message = "Consent status is required")
            ConsentStatus consentStatus,
            List<String> permittedChannels,
            @Size(max = 64, message = "Consent source must be 64 characters or fewer")
            String consentSource
    ) {
    }
}
