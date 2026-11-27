package com.ordexa.intervention.rules;

import com.ordexa.calling.entity.CallOutcome;
import com.ordexa.intervention.assembler.InterventionInputContext;
import com.ordexa.intervention.config.NbieProperties;
import com.ordexa.intervention.model.InterventionEnums.AddressCompletenessState;
import com.ordexa.intervention.model.InterventionEnums.CodConfirmationStatus;
import com.ordexa.intervention.model.InterventionEnums.InterventionChannel;
import com.ordexa.intervention.model.InterventionEnums.LandmarkPresence;
import com.ordexa.intervention.model.InterventionEnums.PinValidityState;
import com.ordexa.intervention.model.InterventionPriority;
import com.ordexa.intervention.model.InterventionType;
import com.ordexa.order.entity.PaymentMethod;
import com.ordexa.order.entity.PaymentStatus;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Pure, deterministic, stateless, versioned NBIE rule evaluator (NBIE_RULESET_V1).
 *
 * Guarantees:
 *   - No LLM calls and no uncalibrated "AI confidence" percentages.
 *   - Cold-start customers (0 prior orders) are treated neutrally — never penalized.
 *   - High order value alone never triggers partial advance or negative action.
 *   - High RTO risk alone never declines an order.
 *   - Unanswered/busy/failed calls are treated as inconclusive, never fraud or rejection.
 *   - Never emits any order-level approve/decline/cancel/hold/release action.
 */
@Component
public class InterventionRuleEvaluator {

    public static final String RULESET_V1 = "NBIE_RULESET_V1";
    private static final BigDecimal LOW_COD_SUCCESS_RATE_THRESHOLD = new BigDecimal("50.00");

    private final NbieProperties properties;

    public InterventionRuleEvaluator(NbieProperties properties) {
        this.properties = properties;
    }

    public String activeRulesetVersion() {
        String configured = properties.getRulesetVersion();
        return (configured != null && !configured.isBlank()) ? configured.trim() : RULESET_V1;
    }

    public record CandidateIntervention(
            InterventionType type,
            InterventionPriority priority,
            InterventionChannel proposedChannel,
            List<String> triggeredRuleIds,
            List<String> reasonCodes,
            String explanation,
            List<String> requiredEvidence,
            boolean approvalRequired
    ) {
    }

    /**
     * Generates raw deterministic candidates from trusted pre-dispatch context
     * with a valid, fresh RTO snapshot.
     */
    public List<CandidateIntervention> evaluateCandidates(InterventionInputContext ctx) {
        List<CandidateIntervention> candidates = new ArrayList<>();
        boolean isCod = ctx.paymentMethod() == PaymentMethod.COD;
        var rto = ctx.rtoSnapshot();
        List<String> rtoReasons = rto != null && rto.reasonCodes() != null
                ? rto.reasonCodes()
                : Collections.emptyList();
        String rtoBand = rto != null ? rto.band() : "UNKNOWN";

        boolean hasConflictingOrDenial = !ctx.conflictingEvidenceIndicators().isEmpty()
                || ctx.codConfirmationStatus() == CodConfirmationStatus.DENIED
                || ctx.codConfirmationStatus() == CodConfirmationStatus.CANCELLATION_REQUESTED
                || ctx.lastCallingOutcome() == CallOutcome.HUMAN_ESCALATION
                || ctx.lastCallingOutcome() == CallOutcome.INVALID_NUMBER
                || (isCod && !ctx.phoneRoutable());

        // ── Rule NBIE-COLD-001: Cold-start neutrality (explicit no-negative-candidate guard)
        // First-time buyers (priorOrderCount == 0) never receive a negative behavioural candidate.

        // ── Rule NBIE-REVIEW-001: Conflicting evidence, explicit denial/cancellation, or unreachable phone
        if (hasConflictingOrDenial) {
            Set<String> reasons = new LinkedHashSet<>();
            List<String> evidenceNeeded = new ArrayList<>();
            List<String> explanationParts = new ArrayList<>();

            if (!ctx.conflictingEvidenceIndicators().isEmpty()) {
                reasons.add("CONFLICTING_EVIDENCE");
                reasons.addAll(ctx.conflictingEvidenceIndicators());
                evidenceNeeded.add("operator_evidence_reconciliation");
                explanationParts.add("Conflicting verification signals detected ("
                        + String.join(", ", ctx.conflictingEvidenceIndicators()) + ").");
            }
            if (ctx.codConfirmationStatus() == CodConfirmationStatus.DENIED) {
                reasons.add("CALL_DENIED_ORDER");
                evidenceNeeded.add("order_authenticity_verification");
                explanationParts.add("Customer previously denied placing this order.");
            }
            if (ctx.codConfirmationStatus() == CodConfirmationStatus.CANCELLATION_REQUESTED) {
                reasons.add("CALL_CANCELLATION_INTENT");
                evidenceNeeded.add("customer_cancellation_request_review");
                explanationParts.add("Customer requested cancellation during verification.");
            }
            if (ctx.lastCallingOutcome() == CallOutcome.HUMAN_ESCALATION) {
                reasons.add("CALL_REQUIRES_HUMAN_FOLLOWUP");
                evidenceNeeded.add("specialist_callback_resolution");
                explanationParts.add("Customer requested a live specialist during voice verification.");
            }
            if (ctx.lastCallingOutcome() == CallOutcome.INVALID_NUMBER || (isCod && !ctx.phoneRoutable())) {
                reasons.add("UNREACHABLE_OR_INVALID_PHONE");
                evidenceNeeded.add("verified_contact_number");
                explanationParts.add("Destination phone number is invalid or unroutable for automated verification.");
            }

            candidates.add(new CandidateIntervention(
                    InterventionType.HUMAN_REVIEW,
                    InterventionPriority.HIGH,
                    InterventionChannel.INTERNAL_QUEUE,
                    List.of("NBIE-REVIEW-001"),
                    List.copyOf(reasons),
                    String.join(" ", explanationParts)
                            + " Route to a merchant operator for review (this recommendation does not hold or cancel the order).",
                    evidenceNeeded.stream().distinct().toList(),
                    true));
        }

        // Do not propose automated customer contact if buyer already denied or asked to cancel
        boolean customerExplicitlyDeclined = ctx.codConfirmationStatus() == CodConfirmationStatus.DENIED
                || ctx.codConfirmationStatus() == CodConfirmationStatus.CANCELLATION_REQUESTED;

        // ── Rule NBIE-ADDR-001: Missing or invalid required address / landmark details
        boolean addressIssue = ctx.addressCompleteness() == AddressCompletenessState.INCOMPLETE
                || ctx.addressCompleteness() == AddressCompletenessState.UNKNOWN
                || ctx.pinValidityState() == PinValidityState.INVALID
                || ctx.landmarkPresence() == LandmarkPresence.MISSING
                || rtoReasons.contains("ADDRESS_INCOMPLETE");

        if (addressIssue && !customerExplicitlyDeclined) {
            List<String> missing = ctx.missingAddressFields() != null && !ctx.missingAddressFields().isEmpty()
                    ? ctx.missingAddressFields()
                    : List.of("landmark");

            boolean severeAddressGap = ctx.pinValidityState() == PinValidityState.INVALID
                    || missing.contains("shipping_address")
                    || missing.contains("house_or_street")
                    || missing.contains("pin_code")
                    || missing.contains("valid_pin_code");

            Set<String> addrReasons = new LinkedHashSet<>();
            addrReasons.add("ADDRESS_INCOMPLETE");
            if (ctx.pinValidityState() == PinValidityState.INVALID) {
                addrReasons.add("PIN_CODE_INVALID");
            } else if (ctx.pinValidityState() == PinValidityState.UNKNOWN) {
                addrReasons.add("PIN_CODE_MISSING");
            }
            if (ctx.landmarkPresence() == LandmarkPresence.MISSING) {
                addrReasons.add("LANDMARK_MISSING");
            }

            InterventionPriority addrPriority = (severeAddressGap || "HIGH".equals(rtoBand))
                    ? InterventionPriority.HIGH
                    : InterventionPriority.MEDIUM;

            candidates.add(new CandidateIntervention(
                    InterventionType.ADDRESS_CLARIFICATION,
                    addrPriority,
                    InterventionChannel.VOICE_SANDBOX,
                    List.of("NBIE-ADDR-001"),
                    List.copyOf(addrReasons),
                    "Request only the missing or ambiguous delivery address details ("
                            + String.join(", ", missing) + ") to reduce failed doorstep locate attempts.",
                    missing,
                    ctx.policy().requireApprovalForContact()));
        }

        // ── Rule NBIE-COD-001: COD order with confirmation pending
        // Unanswered, busy, or transport-failed calls remain PENDING (inconclusive, never fraud).
        boolean codConfirmationPending = isCod
                && (ctx.codConfirmationStatus() == CodConfirmationStatus.PENDING
                        || ctx.codConfirmationStatus() == CodConfirmationStatus.UNKNOWN
                        || ctx.callSignalStale())
                && ctx.orderValue().compareTo(ctx.policy().codConfirmationMinOrderValue()) >= 0;

        if (codConfirmationPending && !customerExplicitlyDeclined) {
            Set<String> codReasons = new LinkedHashSet<>();
            codReasons.add("CONFIRMATION_PENDING");
            if (ctx.lastCallingOutcome() == CallOutcome.NO_ANSWER || ctx.lastCallingOutcome() == CallOutcome.BUSY) {
                codReasons.add("PRIOR_CALL_INCONCLUSIVE_UNANSWERED");
            } else if (ctx.lastCallingOutcome() == CallOutcome.CALL_FAILED) {
                codReasons.add("PRIOR_CALL_TRANSPORT_FAILED_NEUTRAL");
            }
            if (ctx.callSignalStale()) {
                codReasons.add("CALL_SIGNAL_STALE");
            }

            boolean highUrgency = "HIGH".equals(rtoBand)
                    || ctx.orderValue().compareTo(ctx.policy().partialAdvanceMinOrderValue()) >= 0;

            String callNote = (ctx.lastCallingOutcome() == CallOutcome.NO_ANSWER
                    || ctx.lastCallingOutcome() == CallOutcome.BUSY
                    || ctx.lastCallingOutcome() == CallOutcome.CALL_FAILED)
                    ? " Prior call outcome (" + ctx.lastCallingOutcome().name()
                            + ") is treated as inconclusive, not rejection."
                    : "";

            candidates.add(new CandidateIntervention(
                    InterventionType.COD_CONFIRMATION,
                    highUrgency ? InterventionPriority.HIGH : InterventionPriority.MEDIUM,
                    InterventionChannel.VOICE_SANDBOX,
                    List.of("NBIE-COD-001"),
                    List.copyOf(codReasons),
                    "Confirm customer intent and delivery availability for this Cash-on-Delivery order." + callNote,
                    List.of("cod_intent_confirmation"),
                    ctx.policy().requireApprovalForContact()));
        }

        // ── Rule NBIE-ADV-001: Voluntary partial advance for high-value COD + corroborating risk signal
        // Order value alone and cold-start history alone are NEVER sufficient.
        boolean highValueCod = isCod
                && ctx.paymentStatus() == PaymentStatus.PENDING
                && ctx.orderValue().compareTo(ctx.policy().partialAdvanceMinOrderValue()) >= 0;

        boolean hasCorroboratingNonColdStartIndicator = !ctx.coldStartCustomer() && (
                ctx.priorCancelledBeforeDispatchCount() >= 2
                || rtoReasons.contains("REPEATED_COD_REFUSAL")
                || rtoReasons.contains("HISTORICAL_CONFIRMATION_FAILURE")
                || (ctx.priorCodSuccessRate() != null
                        && ctx.priorCodSuccessRate().compareTo(LOW_COD_SUCCESS_RATE_THRESHOLD) < 0)
        ) || ("HIGH".equals(rtoBand) && addressIssue && codConfirmationPending && !ctx.coldStartCustomer());

        if (highValueCod && hasCorroboratingNonColdStartIndicator && !customerExplicitlyDeclined) {
            Set<String> advReasons = new LinkedHashSet<>();
            advReasons.add("HIGH_VALUE_ORDER");
            if (rtoReasons.contains("REPEATED_COD_REFUSAL") || ctx.priorCancelledBeforeDispatchCount() >= 2) {
                advReasons.add("REPEATED_COD_REFUSAL");
            }
            if (rtoReasons.contains("HISTORICAL_CONFIRMATION_FAILURE")) {
                advReasons.add("HISTORICAL_CONFIRMATION_FAILURE");
            }
            if (ctx.priorCodSuccessRate() != null
                    && ctx.priorCodSuccessRate().compareTo(LOW_COD_SUCCESS_RATE_THRESHOLD) < 0) {
                advReasons.add("LOW_PRIOR_COD_DELIVERY_RATE");
            }

            candidates.add(new CandidateIntervention(
                    InterventionType.OPTIONAL_PARTIAL_ADVANCE,
                    InterventionPriority.LOW,
                    InterventionChannel.VOICE_SANDBOX,
                    List.of("NBIE-ADV-001"),
                    List.copyOf(advReasons),
                    "Offer a strictly voluntary partial advance option on high-value COD combined with corroborating risk indicators. NBIE never collects or forces payment.",
                    List.of("voluntary_partial_advance_election"),
                    true));
        }

        // ── Rule NBIE-REVIEW-002: Multiple unresolved high-risk indicators or exhausted unanswered calls
        boolean exhaustedCalls = ctx.callingAttemptCount() > 0
                && ctx.callingAttemptCount() >= ctx.maxCallingAttempts()
                && (ctx.lastCallingOutcome() == CallOutcome.NO_ANSWER
                        || ctx.lastCallingOutcome() == CallOutcome.BUSY
                        || ctx.lastCallingOutcome() == CallOutcome.UNCERTAIN);

        int unresolvedSignalCount = (addressIssue ? 1 : 0)
                + (codConfirmationPending ? 1 : 0)
                + (exhaustedCalls ? 1 : 0)
                + (rtoReasons.contains("REPEATED_COD_REFUSAL") ? 1 : 0)
                + (rtoReasons.contains("HISTORICAL_CONFIRMATION_FAILURE") ? 1 : 0);

        boolean highRiskWithoutTargetedCandidate = "HIGH".equals(rtoBand) && candidates.isEmpty();

        if (!hasConflictingOrDenial
                && ((exhaustedCalls && codConfirmationPending)
                        || ("HIGH".equals(rtoBand) && unresolvedSignalCount >= 2)
                        || highRiskWithoutTargetedCandidate)) {
            Set<String> revReasons = new LinkedHashSet<>();
            if ("HIGH".equals(rtoBand)) {
                revReasons.add("HIGH_RTO_RISK_BAND");
            }
            if (exhaustedCalls) {
                revReasons.add("REPEATED_UNANSWERED_CALLS");
            }
            if (rtoReasons.contains("REPEATED_COD_REFUSAL")) {
                revReasons.add("REPEATED_COD_REFUSAL");
            }
            if (rtoReasons.contains("HISTORICAL_CONFIRMATION_FAILURE")) {
                revReasons.add("HISTORICAL_CONFIRMATION_FAILURE");
            }
            if (addressIssue) {
                revReasons.add("ADDRESS_INCOMPLETE");
            }
            if (codConfirmationPending) {
                revReasons.add("CONFIRMATION_PENDING");
            }

            candidates.add(new CandidateIntervention(
                    InterventionType.HUMAN_REVIEW,
                    "HIGH".equals(rtoBand) ? InterventionPriority.HIGH : InterventionPriority.MEDIUM,
                    InterventionChannel.INTERNAL_QUEUE,
                    List.of("NBIE-REVIEW-002"),
                    List.copyOf(revReasons),
                    "Multiple unresolved risk indicators or exhausted automated call attempts warrant operator inspection. High risk alone never declines an order.",
                    List.of("operator_manual_review"),
                    true));
        }

        return candidates;
    }

    /**
     * Rule NBIE-REVIEW-003: When contact candidates were justified by evidence
     * but all outbound contact channels were suppressed by consent/DNC/caps/policy,
     * surface HUMAN_REVIEW so uncertainty is not silently ignored.
     */
    public CandidateIntervention buildContactSuppressedReviewFallback(
            List<String> suppressionReasons,
            List<String> underlyingReasonCodes) {
        Set<String> combined = new LinkedHashSet<>();
        combined.add("CONTACT_SUPPRESSED_BY_POLICY_OR_CONSENT");
        combined.addAll(suppressionReasons);
        combined.addAll(underlyingReasonCodes);

        return new CandidateIntervention(
                InterventionType.HUMAN_REVIEW,
                InterventionPriority.MEDIUM,
                InterventionChannel.INTERNAL_QUEUE,
                List.of("NBIE-REVIEW-003"),
                List.copyOf(combined),
                "Customer outreach was suppressed due to consent, opt-out, or channel policy constraints ("
                        + String.join(", ", suppressionReasons)
                        + "). Route unresolved pre-dispatch uncertainty to an operator without contacting the customer.",
                List.of("operator_non_contact_review"),
                true);
    }

    /**
     * Rule NBIE-NONE-001: Explicit no-intervention baseline when risk is low,
     * address is complete, and confirmation is resolved or not applicable.
     */
    public CandidateIntervention buildNoInterventionBaseline(InterventionInputContext ctx) {
        Set<String> reasons = new LinkedHashSet<>();
        reasons.add("NO_UNRESOLVED_PRE_DISPATCH_UNCERTAINTY");
        if (ctx.coldStartCustomer()) {
            reasons.add("COLD_START_NEUTRAL");
        }
        return new CandidateIntervention(
                InterventionType.NO_INTERVENTION,
                InterventionPriority.NONE,
                InterventionChannel.NONE,
                List.of("NBIE-NONE-001"),
                List.copyOf(reasons),
                "No pre-dispatch intervention is currently justified based on available evidence. "
                        + "This recommendation is NOT an order approval; final order disposition belongs to a separate decision engine.",
                Collections.emptyList(),
                false);
    }
}
