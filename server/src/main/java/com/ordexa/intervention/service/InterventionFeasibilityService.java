package com.ordexa.intervention.service;

import com.ordexa.intervention.assembler.InterventionInputContext;
import com.ordexa.intervention.model.InterventionEnums.ConsentStatus;
import com.ordexa.intervention.model.InterventionEnums.DispatchLifecycleState;
import com.ordexa.intervention.model.InterventionEnums.InterventionChannel;
import com.ordexa.intervention.model.InterventionType;
import com.ordexa.intervention.rules.InterventionRuleEvaluator.CandidateIntervention;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * Enforces hard consent, DNC opt-out, channel availability, contact caps,
 * cooldowns, duplicate suppression, and merchant policy constraints.
 *
 * Unknown consent is NEVER treated as permission to contact.
 */
@Service
public class InterventionFeasibilityService {

    public record FilteredCandidateDrop(
            InterventionType type,
            String dropCode,
            String reason
    ) {
    }

    public record FeasibilityResult(
            List<CandidateIntervention> feasibleCandidates,
            List<FilteredCandidateDrop> droppedCandidates,
            boolean contactCandidatesSuppressed,
            List<String> contactSuppressionCodes
    ) {
    }

    public FeasibilityResult filterCandidates(
            InterventionInputContext ctx,
            List<CandidateIntervention> rawCandidates) {

        List<CandidateIntervention> feasible = new ArrayList<>();
        List<FilteredCandidateDrop> dropped = new ArrayList<>();
        Set<String> contactSuppressionCodes = new LinkedHashSet<>();
        int contactCandidatesSeen = 0;
        int contactCandidatesKept = 0;

        for (CandidateIntervention candidate : rawCandidates) {
            InterventionType type = candidate.type();
            if (type.requiresCustomerContact()) {
                contactCandidatesSeen++;
            }

            if (ctx.dispatchLifecycleState() != DispatchLifecycleState.PRE_DISPATCH) {
                dropped.add(new FilteredCandidateDrop(
                        type, "LIFECYCLE_NOT_PRE_DISPATCH", "Order is not in a pre-dispatch lifecycle state."));
                continue;
            }

            if (ctx.completedInterventionTypes().contains(type)) {
                dropped.add(new FilteredCandidateDrop(
                        type, "INTERVENTION_ALREADY_COMPLETED", type.name() + " has already been completed for this order."));
                continue;
            }

            if (ctx.activePendingInterventionTypes().contains(type)) {
                dropped.add(new FilteredCandidateDrop(
                        type, "ACTIVE_DUPLICATE_INTERVENTION", type.name() + " already has an active pending item."));
                continue;
            }

            // Merchant policy enablement per intervention type
            String policyBlock = checkPolicyEnablement(ctx, type);
            if (policyBlock != null) {
                dropped.add(new FilteredCandidateDrop(type, policyBlock, "Disabled by merchant intervention policy (" + policyBlock + ")."));
                if (type.requiresCustomerContact()) {
                    contactSuppressionCodes.add(policyBlock);
                }
                continue;
            }

            // Outbound customer contact hard constraints
            if (type.requiresCustomerContact()) {
                String contactBlock = evaluateContactGate(ctx, candidate.proposedChannel());
                if (contactBlock != null) {
                    dropped.add(new FilteredCandidateDrop(
                            type, contactBlock, "Outbound customer contact suppressed: " + contactBlock));
                    contactSuppressionCodes.add(contactBlock);
                    continue;
                }
                contactCandidatesKept++;
            }

            feasible.add(candidate);
        }

        boolean allContactSuppressed = contactCandidatesSeen > 0 && contactCandidatesKept == 0;
        return new FeasibilityResult(
                feasible,
                dropped,
                allContactSuppressed,
                List.copyOf(contactSuppressionCodes));
    }

    /**
     * Re-verifies consent, DNC, lifecycle, and merchant policy immediately prior to execution.
     */
    public String verifyExecutionEligibility(
            InterventionInputContext freshCtx,
            InterventionType type,
            InterventionChannel channel) {
        if (freshCtx.dispatchLifecycleState() != DispatchLifecycleState.PRE_DISPATCH) {
            return "LIFECYCLE_NOT_PRE_DISPATCH";
        }
        if (!freshCtx.policy().enabled()) {
            return "POLICY_DISABLED";
        }
        String policyBlock = checkPolicyEnablement(freshCtx, type);
        if (policyBlock != null) {
            return policyBlock;
        }
        if (type.requiresCustomerContact()) {
            return evaluateContactGate(freshCtx, channel);
        }
        return null;
    }

    private String checkPolicyEnablement(InterventionInputContext ctx, InterventionType type) {
        var policy = ctx.policy();
        if (!policy.enabled()) {
            return "POLICY_DISABLED";
        }
        return switch (type) {
            case COD_CONFIRMATION -> policy.codConfirmationEnabled() ? null : "COD_CONFIRMATION_POLICY_DISABLED";
            case ADDRESS_CLARIFICATION -> policy.addressClarificationEnabled() ? null : "ADDRESS_CLARIFICATION_POLICY_DISABLED";
            case HUMAN_REVIEW -> policy.humanReviewEnabled() ? null : "HUMAN_REVIEW_POLICY_DISABLED";
            case OPTIONAL_PARTIAL_ADVANCE -> {
                if (!policy.partialAdvanceEnabled()) {
                    yield "PARTIAL_ADVANCE_POLICY_DISABLED";
                }
                if (!policy.partialAdvancePaymentCapable()) {
                    yield "PARTIAL_ADVANCE_PAYMENT_CAPABILITY_UNAVAILABLE";
                }
                yield null;
            }
            case NO_INTERVENTION -> null;
        };
    }

    private String evaluateContactGate(InterventionInputContext ctx, InterventionChannel channel) {
        if (ctx.dncOptedOut()) {
            return "DNC_OPTED_OUT";
        }
        if (ctx.consentStatus() == ConsentStatus.DENIED) {
            return "CONSENT_DENIED";
        }
        if (!ctx.consentStatus().permitsOutboundContact()) {
            // Covers UNKNOWN and null: unknown consent is never permission to contact
            return "CONSENT_UNKNOWN_NOT_PERMITTED";
        }
        if (!ctx.phoneRoutable()) {
            return "UNROUTABLE_PHONE_NUMBER";
        }
        if (channel == null || channel == InterventionChannel.NONE) {
            return "NO_CONTACT_CHANNEL";
        }
        if (!ctx.policy().enabledChannels().contains(channel)) {
            return "CHANNEL_DISABLED_BY_MERCHANT_POLICY";
        }
        if (!ctx.permittedCustomerChannels().contains(channel)) {
            return "CHANNEL_NOT_PERMITTED_BY_CONSENT";
        }
        if (channel == InterventionChannel.VOICE_SANDBOX && !ctx.callingChannelEnabled()) {
            return "VOICE_CALLING_CONFIGURATION_DISABLED";
        }
        if (ctx.orderContactCount() >= ctx.policy().maxContactsPerOrder()) {
            return "ORDER_CONTACT_CAP_REACHED";
        }
        if (ctx.customerContactCount24h() >= ctx.policy().maxContactsPerCustomer24h()) {
            return "CUSTOMER_24H_CONTACT_CAP_REACHED";
        }
        if (ctx.lastContactAt() != null && ctx.policy().minHoursBetweenContacts() > 0) {
            long elapsedMinutes = Duration.between(ctx.lastContactAt(), ctx.assembledAt()).toMinutes();
            long requiredMinutes = ctx.policy().minHoursBetweenContacts() * 60L;
            if (elapsedMinutes >= 0 && elapsedMinutes < requiredMinutes) {
                return "CONTACT_COOLDOWN_ACTIVE";
            }
        }
        return null;
    }
}
