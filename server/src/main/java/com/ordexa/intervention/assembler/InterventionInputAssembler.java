package com.ordexa.intervention.assembler;

import com.ordexa.calling.entity.CallAttempt;
import com.ordexa.calling.entity.CallOutcome;
import com.ordexa.calling.entity.CallSession;
import com.ordexa.calling.entity.CallingConfiguration;
import com.ordexa.calling.entity.CustomerCallingPreference;
import com.ordexa.calling.repository.CallAttemptRepository;
import com.ordexa.calling.repository.CallSessionRepository;
import com.ordexa.calling.repository.CallingConfigurationRepository;
import com.ordexa.calling.repository.CustomerCallingPreferenceRepository;
import com.ordexa.calling.service.CallingDndPolicy;
import com.ordexa.common.exception.ResourceNotFoundException;
import com.ordexa.customer.entity.Customer;
import com.ordexa.intervention.assembler.AddressSignalExtractor.AddressSignals;
import com.ordexa.intervention.assembler.InterventionInputContext.MerchantPolicySnapshot;
import com.ordexa.intervention.assembler.InterventionInputContext.RtoAssessmentSnapshot;
import com.ordexa.intervention.config.NbieProperties;
import com.ordexa.intervention.entity.InterventionCustomerConsent;
import com.ordexa.intervention.entity.InterventionExecutionLog;
import com.ordexa.intervention.entity.InterventionOutcome;
import com.ordexa.intervention.entity.InterventionPolicy;
import com.ordexa.intervention.entity.InterventionRecommendationItem;
import com.ordexa.intervention.model.InterventionEnums.AddressCompletenessState;
import com.ordexa.intervention.model.InterventionEnums.CodConfirmationStatus;
import com.ordexa.intervention.model.InterventionEnums.ConsentStatus;
import com.ordexa.intervention.model.InterventionEnums.DispatchLifecycleState;
import com.ordexa.intervention.model.InterventionEnums.EvidenceCompleteness;
import com.ordexa.intervention.model.InterventionEnums.ExecutionLogStatus;
import com.ordexa.intervention.model.InterventionEnums.InterventionChannel;
import com.ordexa.intervention.model.InterventionEnums.InterventionOutcomeType;
import com.ordexa.intervention.model.InterventionEnums.PinValidityState;
import com.ordexa.intervention.model.InterventionStatus;
import com.ordexa.intervention.model.InterventionType;
import com.ordexa.intervention.repository.InterventionCustomerConsentRepository;
import com.ordexa.intervention.repository.InterventionExecutionLogRepository;
import com.ordexa.intervention.repository.InterventionOutcomeRepository;
import com.ordexa.intervention.repository.InterventionPolicyRepository;
import com.ordexa.intervention.repository.InterventionRecommendationItemRepository;
import com.ordexa.order.entity.Order;
import com.ordexa.order.entity.OrderStatus;
import com.ordexa.order.entity.PaymentMethod;
import com.ordexa.order.repository.OrderRepository;
import com.ordexa.risk.RtoRiskAssessmentDto;
import com.ordexa.risk.RtoRiskScoringService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Trusted server-side NBIE input assembler.
 *
 * Loads order, customer history, address signals, calling verification state,
 * consent/DNC status, contact counts, merchant policy, and the existing 4-pillar
 * RTO risk assessment strictly within the authenticated {@code merchantId}.
 */
@Component
public class InterventionInputAssembler {

    private static final Logger log = LoggerFactory.getLogger(InterventionInputAssembler.class);
    private static final BigDecimal HUNDRED = new BigDecimal("100.00");

    private final OrderRepository orderRepository;
    private final CallSessionRepository callSessionRepository;
    private final CallAttemptRepository callAttemptRepository;
    private final CallingConfigurationRepository callingConfigRepository;
    private final CustomerCallingPreferenceRepository callingPreferenceRepository;
    private final InterventionPolicyRepository policyRepository;
    private final InterventionCustomerConsentRepository consentRepository;
    private final InterventionRecommendationItemRepository itemRepository;
    private final InterventionExecutionLogRepository executionLogRepository;
    private final InterventionOutcomeRepository outcomeRepository;
    private final RtoRiskScoringService rtoRiskScoringService;
    private final NbieProperties nbieProperties;
    private final Clock clock;

    public InterventionInputAssembler(
            OrderRepository orderRepository,
            CallSessionRepository callSessionRepository,
            CallAttemptRepository callAttemptRepository,
            CallingConfigurationRepository callingConfigRepository,
            CustomerCallingPreferenceRepository callingPreferenceRepository,
            InterventionPolicyRepository policyRepository,
            InterventionCustomerConsentRepository consentRepository,
            InterventionRecommendationItemRepository itemRepository,
            InterventionExecutionLogRepository executionLogRepository,
            InterventionOutcomeRepository outcomeRepository,
            RtoRiskScoringService rtoRiskScoringService,
            NbieProperties nbieProperties,
            Clock clock) {
        this.orderRepository = orderRepository;
        this.callSessionRepository = callSessionRepository;
        this.callAttemptRepository = callAttemptRepository;
        this.callingConfigRepository = callingConfigRepository;
        this.callingPreferenceRepository = callingPreferenceRepository;
        this.policyRepository = policyRepository;
        this.consentRepository = consentRepository;
        this.itemRepository = itemRepository;
        this.executionLogRepository = executionLogRepository;
        this.outcomeRepository = outcomeRepository;
        this.rtoRiskScoringService = rtoRiskScoringService;
        this.nbieProperties = nbieProperties;
        this.clock = clock;
    }

    public record AssembledOrderBundle(
            Order order,
            Customer customer,
            InterventionInputContext context
    ) {
    }

    @Transactional(readOnly = true)
    public AssembledOrderBundle assembleForOrder(UUID merchantId, UUID orderId) {
        Order order = orderRepository.findByIdAndMerchantIdWithCustomer(orderId, merchantId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found in active merchant workspace"));
        Customer customer = order.getCustomer();
        OffsetDateTime now = OffsetDateTime.now(clock);

        MerchantPolicySnapshot policy = loadPolicySnapshot(merchantId);
        DispatchLifecycleState dispatchState = deriveDispatchLifecycleState(order.getOrderStatus());

        // 1. Customer History (Merchant-scoped, excluding current order)
        List<Order> allCustomerOrders = orderRepository
                .findByMerchantIdAndCustomerIdOrderByCreatedAtDesc(merchantId, customer.getId());
        List<Order> priorOrders = allCustomerOrders.stream()
                .filter(o -> !o.getId().equals(order.getId()))
                .toList();

        int priorOrderCount = priorOrders.size();
        boolean coldStart = priorOrderCount == 0;
        int verifiedDeliveries = (int) priorOrders.stream()
                .filter(o -> o.getOrderStatus() == OrderStatus.DELIVERED)
                .count();
        int priorCancelledBeforeDispatch = (int) priorOrders.stream()
                .filter(o -> o.getOrderStatus() == OrderStatus.CANCELLED)
                .count();

        // Verified courier RTO telemetry does not exist in orders schema; never infer from CANCELLED.
        Integer verifiedRtoCount = null;

        int verifiedCodDeliveries = (int) priorOrders.stream()
                .filter(o -> o.getPaymentMethod() == PaymentMethod.COD && o.getOrderStatus() == OrderStatus.DELIVERED)
                .count();
        int eligibleCompletedCodCount = verifiedCodDeliveries;
        BigDecimal priorCodSuccessRate = computePriorCodSuccessRate(verifiedCodDeliveries, null);

        // 2. Prior NBIE Items & Outcomes on this Order
        List<InterventionOutcome> orderOutcomes = outcomeRepository
                .findByMerchantIdAndOrderIdOrderByRecordedAtDesc(merchantId, order.getId());
        List<InterventionOutcomeType> outcomeTypes = orderOutcomes.stream()
                .map(InterventionOutcome::getOutcomeType)
                .toList();

        List<InterventionRecommendationItem> historicalItems = itemRepository
                .findAllByMerchantIdAndOrderId(merchantId, order.getId());
        Set<InterventionType> completedTypes = EnumSet.noneOf(InterventionType.class);
        Set<InterventionType> activePendingTypes = EnumSet.noneOf(InterventionType.class);

        for (InterventionRecommendationItem hist : historicalItems) {
            if (hist.getInterventionType() == InterventionType.NO_INTERVENTION) {
                continue;
            }
            if (hist.getStatus() == InterventionStatus.COMPLETED) {
                completedTypes.add(hist.getInterventionType());
            } else if (hist.getRecommendation().isActiveRecord()
                    && (hist.getStatus() == InterventionStatus.ACTION_APPROVED
                            || hist.getStatus() == InterventionStatus.EXECUTION_PENDING
                            || hist.getStatus() == InterventionStatus.EXECUTING
                            || hist.getStatus() == InterventionStatus.EXECUTED
                            || hist.getStatus() == InterventionStatus.OUTCOME_PENDING)) {
                activePendingTypes.add(hist.getInterventionType());
            }
        }
        if (outcomeTypes.contains(InterventionOutcomeType.ADDRESS_DETAILS_PROVIDED)) {
            completedTypes.add(InterventionType.ADDRESS_CLARIFICATION);
        }
        if (outcomeTypes.contains(InterventionOutcomeType.CUSTOMER_CONFIRMED_INTENT)) {
            completedTypes.add(InterventionType.COD_CONFIRMATION);
        }
        if (outcomeTypes.contains(InterventionOutcomeType.PARTIAL_ADVANCE_VOLUNTARILY_PAID)) {
            completedTypes.add(InterventionType.OPTIONAL_PARTIAL_ADVANCE);
        }

        // 3. Address Signals (if customer already provided address details via verified outcome, reflect completion)
        AddressSignals rawAddressSignals = AddressSignalExtractor.extract(
                order.getShippingAddress(), order.getCustomerNotes());
        AddressCompletenessState effectiveAddrCompleteness =
                outcomeTypes.contains(InterventionOutcomeType.ADDRESS_DETAILS_PROVIDED)
                        && rawAddressSignals.pinValidityState() != PinValidityState.INVALID
                        ? AddressCompletenessState.COMPLETE
                        : rawAddressSignals.completenessState();
        List<String> effectiveMissingAddrFields =
                effectiveAddrCompleteness == AddressCompletenessState.COMPLETE
                        ? Collections.emptyList()
                        : rawAddressSignals.missingFields();

        boolean phoneRoutable = CallingDndPolicy.isRoutablePhone(customer.getPhoneNumber());

        // 4. Calling Session & Contact History
        CallSession callSession = callSessionRepository
                .findByMerchantIdAndOrder_Id(merchantId, order.getId())
                .orElse(null);

        CallOutcome lastCallOutcome = callSession != null ? callSession.getFinalOutcome() : null;
        int callAttemptCount = callSession != null ? callSession.getAttemptCount() : 0;
        int maxCallAttempts = callSession != null ? callSession.getMaxAttempts() : 3;
        OffsetDateTime lastCallAttemptAt = callSession != null ? callSession.getLastAttemptAt() : null;

        boolean callSignalStale = false;
        if (lastCallAttemptAt != null) {
            long ageHours = Duration.between(lastCallAttemptAt, now).toHours();
            if (ageHours > nbieProperties.getStaleCallSignalHours()
                    && lastCallOutcome != CallOutcome.CONFIRMED
                    && lastCallOutcome != CallOutcome.REJECTED
                    && lastCallOutcome != CallOutcome.CANCELLATION_REQUESTED) {
                callSignalStale = true;
            }
        }

        // 5. Consent, Opt-out, DND Window, and Contact Caps
        CallingConfiguration callingCfg = callingConfigRepository.findByMerchantId(merchantId).orElse(null);
        boolean callingEnabled = callingCfg == null || callingCfg.isEnabled();
        int dndStart = callingCfg != null ? callingCfg.getDndStartHourIst() : 21;
        int dndEnd = callingCfg != null ? callingCfg.getDndEndHourIst() : 9;
        int dndResumeMin = callingCfg != null ? callingCfg.getDndResumeMinuteIst() : 5;
        boolean inDndWindow = CallingDndPolicy.isInDndWindow(now, dndStart, dndEnd, dndResumeMin);

        CustomerCallingPreference callPref = callingPreferenceRepository
                .findByMerchantIdAndCustomerId(merchantId, customer.getId())
                .orElse(null);
        boolean prefOptedOut = callPref != null && callPref.isOptedOut();
        boolean sessionOptedOut = callSession != null
                && callSession.isDoNotCallFurther()
                && (lastCallOutcome == CallOutcome.CANCELLATION_REQUESTED
                        || lastCallOutcome == CallOutcome.REJECTED);
        boolean dncOptedOut = prefOptedOut || sessionOptedOut;

        InterventionCustomerConsent consentEntity = consentRepository
                .findByMerchantIdAndCustomerId(merchantId, customer.getId())
                .orElse(null);

        ConsentStatus effectiveConsent;
        String consentSource;
        Set<InterventionChannel> permittedCustomerChannels;
        if (dncOptedOut) {
            effectiveConsent = ConsentStatus.DENIED;
            consentSource = prefOptedOut ? "CUSTOMER_CALLING_OPT_OUT" : "CALL_SESSION_DNC";
            permittedCustomerChannels = Collections.emptySet();
        } else if (consentEntity != null) {
            effectiveConsent = consentEntity.getConsentStatus();
            consentSource = consentEntity.getConsentSource();
            permittedCustomerChannels = parseChannels(consentEntity.getPermittedChannels());
        } else {
            effectiveConsent = ConsentStatus.UNKNOWN;
            consentSource = "NO_CONSENT_RECORD";
            permittedCustomerChannels = Collections.emptySet();
        }

        String preferredLang = (callPref != null && callPref.getPreferredLanguage() != null && !callPref.getPreferredLanguage().isBlank())
                ? callPref.getPreferredLanguage()
                : (callingCfg != null ? callingCfg.getDefaultLanguage() : null);

        // Contact counts across CallAttempts + NBIE ExecutionLogs
        List<InterventionExecutionLog> orderExecLogs = executionLogRepository.findAcceptedByMerchantAndOrder(
                merchantId, order.getId(), ExecutionLogStatus.ACCEPTED_SANDBOX);
        long orderOutboundExecs = orderExecLogs.stream()
                .filter(e -> e.getChannel() != InterventionChannel.INTERNAL_QUEUE && e.getChannel() != InterventionChannel.NONE)
                .count();
        int orderContactCount = Math.max(callAttemptCount, (int) orderOutboundExecs);

        OffsetDateTime since24h = now.minusHours(24);
        List<CallSession> customerSessions = callSessionRepository
                .findByMerchantIdAndCustomer_IdOrderByCreatedAtDesc(merchantId, customer.getId());
        int recentCallContacts = 0;
        OffsetDateTime latestContact = null;
        for (CallSession cs : customerSessions) {
            List<CallAttempt> attempts = callAttemptRepository
                    .findByCallSession_IdAndMerchantIdOrderByAttemptNumberAsc(cs.getId(), merchantId);
            for (CallAttempt att : attempts) {
                if (att.getStartedAt() != null) {
                    if (!att.getStartedAt().isBefore(since24h)) {
                        recentCallContacts++;
                    }
                    if (latestContact == null || att.getStartedAt().isAfter(latestContact)) {
                        latestContact = att.getStartedAt();
                    }
                }
            }
        }
        List<InterventionExecutionLog> recentNbieExecs = executionLogRepository.findRecentAcceptedByMerchantAndCustomer(
                merchantId, customer.getId(), ExecutionLogStatus.ACCEPTED_SANDBOX, since24h);
        int recentNbieContacts = 0;
        for (InterventionExecutionLog exec : recentNbieExecs) {
            if (exec.getChannel() != InterventionChannel.INTERNAL_QUEUE && exec.getChannel() != InterventionChannel.NONE) {
                recentNbieContacts++;
                if (latestContact == null || exec.getExecutedAt().isAfter(latestContact)) {
                    latestContact = exec.getExecutedAt();
                }
            }
        }
        int customerContactCount24h = Math.max(recentCallContacts, recentNbieContacts);

        // 6. COD Confirmation & Conflicting Evidence Detection
        List<String> conflicts = new ArrayList<>();
        CodConfirmationStatus codStatus = resolveCodConfirmationStatus(
                order, lastCallOutcome, outcomeTypes, verifiedDeliveries, conflicts);

        // 7. Existing 4-Pillar RTO Engine Assessment (Only computed for pre-dispatch active evaluation)
        RtoAssessmentSnapshot rtoSnapshot = null;
        if (dispatchState == DispatchLifecycleState.PRE_DISPATCH) {
            try {
                RtoRiskAssessmentDto rtoDto = rtoRiskScoringService.assessOrder(order, customer, callSession);
                if (rtoDto != null && rtoDto.riskBand() != null && !rtoDto.riskBand().isBlank()) {
                    rtoSnapshot = new RtoAssessmentSnapshot(
                            rtoDto.totalRiskScore(),
                            rtoDto.riskBand(),
                            rtoDto.behaviouralRiskPoints(),
                            rtoDto.orderRiskPoints(),
                            rtoDto.callingOutcomePoints(),
                            rtoDto.historicalConfirmationPoints(),
                            rtoDto.reasonCodes() != null ? List.copyOf(rtoDto.reasonCodes()) : Collections.emptyList(),
                            now,
                            false);
                }
            } catch (Exception ex) {
                log.warn("[nbie-assembler] Existing RTO risk assessment unavailable for orderNumber={}: {}",
                        order.getOrderNumber(), ex.getClass().getSimpleName());
            }
        }

        // 8. Data Quality, Unknowns, and Staleness Warnings
        List<String> unknownWarnings = new ArrayList<>();
        List<String> staleWarnings = new ArrayList<>();

        unknownWarnings.add("VERIFIED_RTO_TELEMETRY_UNAVAILABLE_IN_SCHEMA");
        if (priorCodSuccessRate == null && order.getPaymentMethod() == PaymentMethod.COD) {
            unknownWarnings.add("PRIOR_COD_SUCCESS_RATE_UNKNOWN_ZERO_DENOMINATOR");
        }
        if (effectiveConsent == ConsentStatus.UNKNOWN) {
            unknownWarnings.add("CUSTOMER_CONSENT_UNKNOWN");
        }
        if (rawAddressSignals.pinValidityState() == PinValidityState.UNKNOWN) {
            unknownWarnings.add("PIN_CODE_ABSENT_OR_UNVERIFIED");
        }
        if (callSignalStale) {
            staleWarnings.add("PRIOR_CALL_SIGNAL_STALE");
        }
        if (rtoSnapshot != null && rtoSnapshot.stale()) {
            staleWarnings.add("RTO_ASSESSMENT_STALE");
        }

        EvidenceCompleteness evidenceCompleteness = computeEvidenceCompleteness(
                rtoSnapshot, effectiveAddrCompleteness, effectiveConsent, phoneRoutable);

        InterventionInputContext ctx = new InterventionInputContext(
                merchantId,
                order.getId(),
                order.getOrderNumber(),
                customer.getId(),
                order.getTotalAmount(),
                order.getCurrency(),
                order.getPaymentMethod(),
                order.getPaymentStatus(),
                order.getOrderStatus(),
                dispatchState,
                order.getCreatedAt(),
                order.getUpdatedAt(),
                priorOrderCount,
                verifiedDeliveries,
                verifiedRtoCount,
                priorCancelledBeforeDispatch,
                eligibleCompletedCodCount,
                priorCodSuccessRate,
                coldStart,
                rawAddressSignals.formulaVersion(),
                effectiveAddrCompleteness,
                rawAddressSignals.pinValidityState(),
                rawAddressSignals.landmarkPresence(),
                effectiveMissingAddrFields,
                phoneRoutable,
                codStatus,
                lastCallOutcome,
                callSession != null ? callSession.getStatus() : null,
                callAttemptCount,
                maxCallAttempts,
                lastCallAttemptAt,
                callSignalStale,
                effectiveConsent,
                consentSource,
                dncOptedOut,
                permittedCustomerChannels,
                preferredLang,
                callingEnabled,
                inDndWindow,
                orderContactCount,
                customerContactCount24h,
                latestContact,
                rtoSnapshot,
                policy,
                Collections.unmodifiableSet(completedTypes),
                Collections.unmodifiableSet(activePendingTypes),
                outcomeTypes,
                evidenceCompleteness,
                List.copyOf(conflicts),
                List.copyOf(unknownWarnings),
                List.copyOf(staleWarnings),
                now);

        return new AssembledOrderBundle(order, customer, ctx);
    }

    /**
     * Pure helper for computing prior COD success rate.
     * Excludes pending and cancelled-before-dispatch orders.
     * Returns {@code null} when denominator is zero (never coerces 0/0 to 0%).
     */
    public static BigDecimal computePriorCodSuccessRate(int verifiedCodDeliveries, Integer verifiedCodRtos) {
        int rtos = verifiedCodRtos != null ? Math.max(0, verifiedCodRtos) : 0;
        int denominator = Math.max(0, verifiedCodDeliveries) + rtos;
        if (denominator == 0) {
            return null;
        }
        return BigDecimal.valueOf(verifiedCodDeliveries)
                .multiply(HUNDRED)
                .divide(BigDecimal.valueOf(denominator), 2, RoundingMode.HALF_UP);
    }

    public static DispatchLifecycleState deriveDispatchLifecycleState(OrderStatus orderStatus) {
        if (orderStatus == null) {
            return DispatchLifecycleState.PRE_DISPATCH;
        }
        return switch (orderStatus) {
            case CREATED, CONFIRMED, PROCESSING -> DispatchLifecycleState.PRE_DISPATCH;
            case SHIPPED, DELIVERED -> DispatchLifecycleState.POST_DISPATCH;
            case CANCELLED -> DispatchLifecycleState.CANCELLED;
        };
    }

    public MerchantPolicySnapshot loadPolicySnapshot(UUID merchantId) {
        InterventionPolicy entity = policyRepository.findByMerchantId(merchantId).orElse(null);
        if (entity == null) {
            return new MerchantPolicySnapshot(
                    nbieProperties.isEnabled(),
                    true,
                    true,
                    true,
                    false,
                    false,
                    new BigDecimal("2500.00"),
                    new BigDecimal("0.00"),
                    EnumSet.of(InterventionChannel.VOICE_SANDBOX),
                    3,
                    3,
                    2,
                    nbieProperties.getDefaultRecommendationTtlHours(),
                    nbieProperties.getMaxRtoAssessmentAgeMinutes(),
                    true);
        }
        return new MerchantPolicySnapshot(
                nbieProperties.isEnabled() && entity.isEnabled(),
                entity.isCodConfirmationEnabled(),
                entity.isAddressClarificationEnabled(),
                entity.isHumanReviewEnabled(),
                entity.isPartialAdvanceEnabled(),
                entity.isPartialAdvancePaymentCapable(),
                entity.getPartialAdvanceMinOrderValue(),
                entity.getCodConfirmationMinOrderValue(),
                parseChannels(entity.getEnabledChannels()),
                entity.getMaxContactsPerOrder(),
                entity.getMaxContactsPerCustomer24h(),
                entity.getMinHoursBetweenContacts(),
                entity.getRecommendationTtlHours(),
                entity.getMaxRtoAssessmentAgeMinutes(),
                entity.isRequireApprovalForContact());
    }

    private CodConfirmationStatus resolveCodConfirmationStatus(
            Order order,
            CallOutcome lastCallOutcome,
            List<InterventionOutcomeType> outcomeTypes,
            int verifiedDeliveries,
            List<String> conflicts) {

        boolean hasPositiveSignal = lastCallOutcome == CallOutcome.CONFIRMED
                || outcomeTypes.contains(InterventionOutcomeType.CUSTOMER_CONFIRMED_INTENT)
                || order.getOrderStatus() == OrderStatus.CONFIRMED
                || order.getOrderStatus() == OrderStatus.PROCESSING;

        boolean hasDenialSignal = lastCallOutcome == CallOutcome.REJECTED
                || outcomeTypes.contains(InterventionOutcomeType.CUSTOMER_DENIED_ORDER);

        boolean hasCancelSignal = lastCallOutcome == CallOutcome.CANCELLATION_REQUESTED
                || outcomeTypes.contains(InterventionOutcomeType.CUSTOMER_REQUESTED_CANCELLATION);

        if (hasPositiveSignal && (hasDenialSignal || hasCancelSignal)) {
            conflicts.add("CONTRADICTORY_CONFIRMATION_AND_DENIAL_SIGNALS");
        }
        if (verifiedDeliveries >= 2 && hasDenialSignal) {
            conflicts.add("REPEAT_VERIFIED_BUYER_DENIED_CURRENT_ORDER");
        }

        if (order.getPaymentMethod() != PaymentMethod.COD) {
            if (hasDenialSignal) {
                return CodConfirmationStatus.DENIED;
            }
            if (hasCancelSignal) {
                return CodConfirmationStatus.CANCELLATION_REQUESTED;
            }
            return CodConfirmationStatus.NOT_APPLICABLE;
        }

        if (hasDenialSignal) {
            return CodConfirmationStatus.DENIED;
        }
        if (hasCancelSignal) {
            return CodConfirmationStatus.CANCELLATION_REQUESTED;
        }
        if (hasPositiveSignal) {
            return CodConfirmationStatus.CONFIRMED;
        }
        return CodConfirmationStatus.PENDING;
    }

    private EvidenceCompleteness computeEvidenceCompleteness(
            RtoAssessmentSnapshot rto,
            AddressCompletenessState addrCompleteness,
            ConsentStatus consentStatus,
            boolean phoneRoutable) {
        if (rto == null) {
            return EvidenceCompleteness.INSUFFICIENT;
        }
        int presentSignals = 1; // RTO present
        if (addrCompleteness != AddressCompletenessState.UNKNOWN) {
            presentSignals++;
        }
        if (consentStatus != ConsentStatus.UNKNOWN) {
            presentSignals++;
        }
        if (phoneRoutable) {
            presentSignals++;
        }
        if (presentSignals >= 4) {
            return EvidenceCompleteness.HIGH;
        }
        if (presentSignals >= 3) {
            return EvidenceCompleteness.MEDIUM;
        }
        return EvidenceCompleteness.LOW;
    }

    public static Set<InterventionChannel> parseChannels(String csv) {
        if (csv == null || csv.isBlank()) {
            return Collections.emptySet();
        }
        Set<InterventionChannel> channels = new LinkedHashSet<>();
        Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .forEach(token -> {
                    try {
                        channels.add(InterventionChannel.valueOf(token.toUpperCase(Locale.ROOT)));
                    } catch (IllegalArgumentException ignored) {
                        // Ignore unsupported channel tokens safely
                    }
                });
        return channels;
    }
}
