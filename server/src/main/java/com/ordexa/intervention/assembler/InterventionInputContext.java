package com.ordexa.intervention.assembler;

import com.ordexa.calling.entity.CallOutcome;
import com.ordexa.calling.entity.CallSessionStatus;
import com.ordexa.intervention.model.InterventionEnums.AddressCompletenessState;
import com.ordexa.intervention.model.InterventionEnums.CodConfirmationStatus;
import com.ordexa.intervention.model.InterventionEnums.ConsentStatus;
import com.ordexa.intervention.model.InterventionEnums.DispatchLifecycleState;
import com.ordexa.intervention.model.InterventionEnums.EvidenceCompleteness;
import com.ordexa.intervention.model.InterventionEnums.InterventionChannel;
import com.ordexa.intervention.model.InterventionEnums.InterventionOutcomeType;
import com.ordexa.intervention.model.InterventionEnums.LandmarkPresence;
import com.ordexa.intervention.model.InterventionEnums.PinValidityState;
import com.ordexa.intervention.model.InterventionType;
import com.ordexa.order.entity.OrderStatus;
import com.ordexa.order.entity.PaymentMethod;
import com.ordexa.order.entity.PaymentStatus;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Immutable, server-assembled, tenant-scoped NBIE evaluation input context.
 * Never constructed from untrusted client payloads.
 */
public record InterventionInputContext(
        UUID merchantId,
        UUID orderId,
        String orderNumber,
        UUID customerId,
        BigDecimal orderValue,
        String currency,
        PaymentMethod paymentMethod,
        PaymentStatus paymentStatus,
        OrderStatus orderStatus,
        DispatchLifecycleState dispatchLifecycleState,
        OffsetDateTime orderCreatedAt,
        OffsetDateTime orderUpdatedAt,

        // Customer History (Merchant-scoped)
        int priorOrderCount,
        int verifiedSuccessfulDeliveryCount,
        Integer verifiedRtoCount,
        int priorCancelledBeforeDispatchCount,
        int eligibleCompletedCodOrderCount,
        BigDecimal priorCodSuccessRate,
        boolean coldStartCustomer,

        // Address Signals (PII-minimized)
        String addressFormulaVersion,
        AddressCompletenessState addressCompleteness,
        PinValidityState pinValidityState,
        LandmarkPresence landmarkPresence,
        List<String> missingAddressFields,
        boolean phoneRoutable,

        // Verification & Calling Signals
        CodConfirmationStatus codConfirmationStatus,
        CallOutcome lastCallingOutcome,
        CallSessionStatus callingSessionStatus,
        int callingAttemptCount,
        int maxCallingAttempts,
        OffsetDateTime lastCallAttemptAt,
        boolean callSignalStale,

        // Consent & Contact Eligibility
        ConsentStatus consentStatus,
        String consentSource,
        boolean dncOptedOut,
        Set<InterventionChannel> permittedCustomerChannels,
        String preferredLanguage,
        boolean callingChannelEnabled,
        boolean inDndQuietWindow,
        int orderContactCount,
        int customerContactCount24h,
        OffsetDateTime lastContactAt,

        // Existing 4-Pillar RTO Engine Snapshot
        RtoAssessmentSnapshot rtoSnapshot,

        // Merchant NBIE Policy
        MerchantPolicySnapshot policy,

        // Prior / Active NBIE State on this Order
        Set<InterventionType> completedInterventionTypes,
        Set<InterventionType> activePendingInterventionTypes,
        List<InterventionOutcomeType> recordedOutcomes,

        // Data Quality & Provenance
        EvidenceCompleteness evidenceCompleteness,
        List<String> conflictingEvidenceIndicators,
        List<String> unknownDataWarnings,
        List<String> staleDataWarnings,
        OffsetDateTime assembledAt
) {

    public record RtoAssessmentSnapshot(
            int score,
            String band,
            int behaviouralPoints,
            int orderPoints,
            int callingOutcomePoints,
            int historicalConfirmationPoints,
            List<String> reasonCodes,
            OffsetDateTime assessedAt,
            boolean stale
    ) {
    }

    public record MerchantPolicySnapshot(
            boolean enabled,
            boolean codConfirmationEnabled,
            boolean addressClarificationEnabled,
            boolean humanReviewEnabled,
            boolean partialAdvanceEnabled,
            boolean partialAdvancePaymentCapable,
            BigDecimal partialAdvanceMinOrderValue,
            BigDecimal codConfirmationMinOrderValue,
            Set<InterventionChannel> enabledChannels,
            int maxContactsPerOrder,
            int maxContactsPerCustomer24h,
            int minHoursBetweenContacts,
            int recommendationTtlHours,
            int maxRtoAssessmentAgeMinutes,
            boolean requireApprovalForContact
    ) {
    }
}
