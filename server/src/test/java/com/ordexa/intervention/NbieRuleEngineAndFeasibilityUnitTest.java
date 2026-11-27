package com.ordexa.intervention;

import static org.assertj.core.api.Assertions.assertThat;

import com.ordexa.calling.entity.CallOutcome;
import com.ordexa.calling.entity.CallSessionStatus;
import com.ordexa.intervention.assembler.AddressSignalExtractor;
import com.ordexa.intervention.assembler.InterventionInputAssembler;
import com.ordexa.intervention.assembler.InterventionInputContext;
import com.ordexa.intervention.assembler.InterventionInputContext.MerchantPolicySnapshot;
import com.ordexa.intervention.assembler.InterventionInputContext.RtoAssessmentSnapshot;
import com.ordexa.intervention.config.NbieProperties;
import com.ordexa.intervention.dto.InterventionDtos.RecommendationResponseDto;
import com.ordexa.intervention.model.EvaluationStatus;
import com.ordexa.intervention.model.InterventionEnums.AddressCompletenessState;
import com.ordexa.intervention.model.InterventionEnums.CodConfirmationStatus;
import com.ordexa.intervention.model.InterventionEnums.ConsentStatus;
import com.ordexa.intervention.model.InterventionEnums.DispatchLifecycleState;
import com.ordexa.intervention.model.InterventionEnums.EvidenceCompleteness;
import com.ordexa.intervention.model.InterventionEnums.InterventionChannel;
import com.ordexa.intervention.model.InterventionEnums.LandmarkPresence;
import com.ordexa.intervention.model.InterventionEnums.PinValidityState;
import com.ordexa.intervention.model.InterventionPriority;
import com.ordexa.intervention.model.InterventionType;
import com.ordexa.intervention.rules.InterventionRuleEvaluator;
import com.ordexa.intervention.rules.InterventionRuleEvaluator.CandidateIntervention;
import com.ordexa.intervention.service.InterventionEngineService;
import com.ordexa.intervention.service.InterventionEngineService.EvaluationOutcome;
import com.ordexa.intervention.service.InterventionFeasibilityService;
import com.ordexa.intervention.service.InterventionRankingService;
import com.ordexa.order.entity.OrderStatus;
import com.ordexa.order.entity.PaymentMethod;
import com.ordexa.order.entity.PaymentStatus;
import java.lang.reflect.RecordComponent;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.Collections;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class NbieRuleEngineAndFeasibilityUnitTest {

    private static final OffsetDateTime NOW = OffsetDateTime.of(2026, 11, 27, 6, 30, 0, 0, ZoneOffset.UTC);

    private InterventionRuleEvaluator ruleEvaluator;
    private InterventionFeasibilityService feasibilityService;
    private InterventionRankingService rankingService;
    private InterventionEngineService engineService;

    @BeforeEach
    void setUp() {
        NbieProperties props = new NbieProperties();
        props.setRulesetVersion("NBIE_RULESET_V1");
        ruleEvaluator = new InterventionRuleEvaluator(props);
        feasibilityService = new InterventionFeasibilityService();
        rankingService = new InterventionRankingService();
        engineService = new InterventionEngineService(
                null,
                ruleEvaluator,
                feasibilityService,
                rankingService,
                null,
                null,
                Clock.fixed(Instant.parse("2026-11-27T06:30:00Z"), ZoneOffset.UTC));
    }

    @Test
    void authorityBoundaryForbidsOrderDecisionEnumsAndFields() {
        Set<String> typeNames = Arrays.stream(InterventionType.values())
                .map(Enum::name)
                .collect(java.util.stream.Collectors.toSet());

        assertThat(typeNames).containsExactlyInAnyOrder(
                "COD_CONFIRMATION",
                "ADDRESS_CLARIFICATION",
                "HUMAN_REVIEW",
                "OPTIONAL_PARTIAL_ADVANCE",
                "NO_INTERVENTION");
        assertThat(typeNames).doesNotContain(
                "APPROVE_ORDER",
                "DECLINE_ORDER",
                "CANCEL_ORDER",
                "DISPATCH_HOLD",
                "RELEASE_FOR_DISPATCH");

        List<String> dtoFields = Arrays.stream(RecommendationResponseDto.class.getRecordComponents())
                .map(RecordComponent::getName)
                .toList();
        assertThat(dtoFields).doesNotContain("finalDecision", "orderDecision", "approveOrder");
    }

    @Test
    void zeroDenominatorPriorCodSuccessRateReturnsNullNeverZeroPercent() {
        assertThat(InterventionInputAssembler.computePriorCodSuccessRate(0, 0)).isNull();
        assertThat(InterventionInputAssembler.computePriorCodSuccessRate(0, null)).isNull();
        assertThat(InterventionInputAssembler.computePriorCodSuccessRate(3, 1))
                .isEqualByComparingTo("75.00");
        assertThat(InterventionInputAssembler.computePriorCodSuccessRate(0, 2))
                .isEqualByComparingTo("0.00");
    }

    @Test
    void coldStartFirstTimeCustomerWithCompletePrepaidOrderGetsNoInterventionAndNoNegativePenalty() {
        InterventionInputContext ctx = baseContextBuilder()
                .paymentMethod(PaymentMethod.PREPAID)
                .paymentStatus(PaymentStatus.PAID)
                .priorOrderCount(0)
                .coldStartCustomer(true)
                .codConfirmationStatus(CodConfirmationStatus.NOT_APPLICABLE)
                .rtoSnapshot(new RtoAssessmentSnapshot(10, "LOW", 0, -30, 0, 0, List.of("PREPAID_ORDER_DISCOUNT"), NOW, false))
                .build();

        EvaluationOutcome out = engineService.runPureEvaluationPipeline(ctx);

        assertThat(out.evaluationStatus()).isEqualTo(EvaluationStatus.COMPLETED);
        assertThat(out.rankedItems()).hasSize(1);
        assertThat(out.rankedItems().get(0).candidate().type()).isEqualTo(InterventionType.NO_INTERVENTION);
        assertThat(out.rankedItems().get(0).candidate().reasonCodes()).contains("COLD_START_NEUTRAL");
        assertThat(out.rankedItems().get(0).candidate().explanation()).contains("NOT an order approval");
    }

    @Test
    void pendingCodWithGrantedConsentRecommendsCodConfirmation() {
        InterventionInputContext ctx = baseContextBuilder()
                .paymentMethod(PaymentMethod.COD)
                .codConfirmationStatus(CodConfirmationStatus.PENDING)
                .consentStatus(ConsentStatus.GRANTED)
                .build();

        EvaluationOutcome out = engineService.runPureEvaluationPipeline(ctx);

        assertThat(out.evaluationStatus()).isEqualTo(EvaluationStatus.COMPLETED);
        assertThat(out.rankedItems()).hasSize(1);
        assertThat(out.rankedItems().get(0).candidate().type()).isEqualTo(InterventionType.COD_CONFIRMATION);
        assertThat(out.rankedItems().get(0).candidate().triggeredRuleIds()).contains("NBIE-COD-001");
    }

    @Test
    void incompleteAddressRequestsOnlyMissingFields() {
        var signals = AddressSignalExtractor.extract("House 18, Vaishali Nagar, Jaipur 302021", null);
        assertThat(signals.completenessState()).isEqualTo(AddressCompletenessState.INCOMPLETE);
        assertThat(signals.pinValidityState()).isEqualTo(PinValidityState.VALID);
        assertThat(signals.landmarkPresence()).isEqualTo(LandmarkPresence.MISSING);
        assertThat(signals.missingFields()).containsExactly("landmark");

        InterventionInputContext ctx = baseContextBuilder()
                .paymentMethod(PaymentMethod.PREPAID)
                .paymentStatus(PaymentStatus.PAID)
                .codConfirmationStatus(CodConfirmationStatus.NOT_APPLICABLE)
                .addressCompleteness(signals.completenessState())
                .pinValidityState(signals.pinValidityState())
                .landmarkPresence(signals.landmarkPresence())
                .missingAddressFields(signals.missingFields())
                .build();

        EvaluationOutcome out = engineService.runPureEvaluationPipeline(ctx);
        assertThat(out.rankedItems()).hasSize(1);
        CandidateIntervention primary = out.rankedItems().get(0).candidate();
        assertThat(primary.type()).isEqualTo(InterventionType.ADDRESS_CLARIFICATION);
        assertThat(primary.requiredEvidence()).containsExactly("landmark");
    }

    @Test
    void unknownDeniedConsentDncAndContactCapsSuppressOutboundContactAndFallbackToHumanReview() {
        // 1. Unknown consent
        InterventionInputContext unknownConsent = baseContextBuilder()
                .consentStatus(ConsentStatus.UNKNOWN)
                .permittedCustomerChannels(Collections.emptySet())
                .build();
        EvaluationOutcome unknownOut = engineService.runPureEvaluationPipeline(unknownConsent);
        assertThat(unknownOut.feasibilityResult().contactCandidatesSuppressed()).isTrue();
        assertThat(unknownOut.feasibilityResult().contactSuppressionCodes())
                .contains("CONSENT_UNKNOWN_NOT_PERMITTED");
        assertThat(unknownOut.rankedItems()).hasSize(1);
        assertThat(unknownOut.rankedItems().get(0).candidate().type()).isEqualTo(InterventionType.HUMAN_REVIEW);
        assertThat(unknownOut.rankedItems().get(0).candidate().triggeredRuleIds()).contains("NBIE-REVIEW-003");

        // 2. DNC opted out
        InterventionInputContext dncCtx = baseContextBuilder()
                .consentStatus(ConsentStatus.DENIED)
                .dncOptedOut(true)
                .build();
        EvaluationOutcome dncOut = engineService.runPureEvaluationPipeline(dncCtx);
        assertThat(dncOut.feasibilityResult().contactSuppressionCodes()).contains("DNC_OPTED_OUT");
        assertThat(dncOut.rankedItems().get(0).candidate().type()).isEqualTo(InterventionType.HUMAN_REVIEW);

        // 3. Contact cap reached
        InterventionInputContext capCtx = baseContextBuilder()
                .orderContactCount(3)
                .build();
        EvaluationOutcome capOut = engineService.runPureEvaluationPipeline(capCtx);
        assertThat(capOut.feasibilityResult().contactSuppressionCodes()).contains("ORDER_CONTACT_CAP_REACHED");
        assertThat(capOut.rankedItems().get(0).candidate().type()).isEqualTo(InterventionType.HUMAN_REVIEW);
    }

    @Test
    void highOrderValueAloneNeverTriggersPartialAdvanceAndPolicyGateEnforced() {
        MerchantPolicySnapshot partialEnabledPolicy = new MerchantPolicySnapshot(
                true, true, true, true,
                true, true,
                new BigDecimal("2500.00"),
                BigDecimal.ZERO,
                EnumSet.of(InterventionChannel.VOICE_SANDBOX),
                3, 3, 2, 24, 60, true);

        // Cold-start buyer with Rs 5000 COD and complete address -> value alone MUST NOT trigger NBIE-ADV-001
        InterventionInputContext valueAloneCtx = baseContextBuilder()
                .orderValue(new BigDecimal("5000.00"))
                .priorOrderCount(0)
                .coldStartCustomer(true)
                .policy(partialEnabledPolicy)
                .rtoSnapshot(new RtoAssessmentSnapshot(40, "MEDIUM", 12, 28, 0, 0, List.of("NEW_CUSTOMER", "HIGH_VALUE_ORDER"), NOW, false))
                .build();

        EvaluationOutcome valueAloneOut = engineService.runPureEvaluationPipeline(valueAloneCtx);
        assertThat(valueAloneOut.rankedItems())
                .extracting(r -> r.candidate().type())
                .doesNotContain(InterventionType.OPTIONAL_PARTIAL_ADVANCE);

        // Returning buyer with corroborating refusal history + partial advance enabled -> secondary recommendation
        InterventionInputContext corroboratedCtx = baseContextBuilder()
                .orderValue(new BigDecimal("5000.00"))
                .priorOrderCount(3)
                .priorCancelledBeforeDispatchCount(2)
                .coldStartCustomer(false)
                .policy(partialEnabledPolicy)
                .rtoSnapshot(new RtoAssessmentSnapshot(73, "HIGH", 45, 28, 0, 0, List.of("REPEATED_COD_REFUSAL", "HIGH_VALUE_ORDER"), NOW, false))
                .build();

        EvaluationOutcome corroboratedOut = engineService.runPureEvaluationPipeline(corroboratedCtx);
        assertThat(corroboratedOut.rankedItems())
                .extracting(r -> r.candidate().type())
                .contains(InterventionType.COD_CONFIRMATION, InterventionType.OPTIONAL_PARTIAL_ADVANCE);
        assertThat(corroboratedOut.rankedItems().get(0).candidate().type())
                .isNotEqualTo(InterventionType.OPTIONAL_PARTIAL_ADVANCE);

        // Same corroborated order when merchant disables partialAdvance -> filtered out!
        InterventionInputContext disabledPolicyCtx = baseContextBuilder()
                .orderValue(new BigDecimal("5000.00"))
                .priorOrderCount(3)
                .priorCancelledBeforeDispatchCount(2)
                .coldStartCustomer(false)
                .rtoSnapshot(new RtoAssessmentSnapshot(73, "HIGH", 45, 28, 0, 0, List.of("REPEATED_COD_REFUSAL", "HIGH_VALUE_ORDER"), NOW, false))
                .build();

        EvaluationOutcome disabledOut = engineService.runPureEvaluationPipeline(disabledPolicyCtx);
        assertThat(disabledOut.rankedItems())
                .extracting(r -> r.candidate().type())
                .doesNotContain(InterventionType.OPTIONAL_PARTIAL_ADVANCE);
        assertThat(disabledOut.feasibilityResult().droppedCandidates())
                .anyMatch(d -> d.type() == InterventionType.OPTIONAL_PARTIAL_ADVANCE
                        && "PARTIAL_ADVANCE_POLICY_DISABLED".equals(d.dropCode()));
    }

    @Test
    void unansweredBusyAndFailedCallsAreTreatedAsInconclusiveNotFraudOrRejection() {
        for (CallOutcome outcome : List.of(CallOutcome.NO_ANSWER, CallOutcome.BUSY, CallOutcome.CALL_FAILED)) {
            InterventionInputContext ctx = baseContextBuilder()
                    .lastCallingOutcome(outcome)
                    .callingAttemptCount(1)
                    .maxCallingAttempts(3)
                    .build();

            EvaluationOutcome out = engineService.runPureEvaluationPipeline(ctx);
            assertThat(out.rankedItems()).isNotEmpty();
            CandidateIntervention primary = out.rankedItems().get(0).candidate();
            assertThat(primary.type()).isEqualTo(InterventionType.COD_CONFIRMATION);
            assertThat(primary.explanation()).containsIgnoringCase("inconclusive");
        }
    }

    @Test
    void missingOrStaleRtoAndPostDispatchOrdersReturnStructuredStatusesWithoutFabricatingRisk() {
        // Missing RTO
        InterventionInputContext missingRto = baseContextBuilder().rtoSnapshot(null).build();
        assertThat(engineService.runPureEvaluationPipeline(missingRto).evaluationStatus())
                .isEqualTo(EvaluationStatus.ASSESSMENT_UNAVAILABLE);

        // Stale RTO (120 mins old vs 60 min limit)
        InterventionInputContext staleRto = baseContextBuilder()
                .rtoSnapshot(new RtoAssessmentSnapshot(45, "MEDIUM", 20, 25, 0, 0, List.of("CONFIRMATION_PENDING"), NOW.minusMinutes(120), false))
                .build();
        assertThat(engineService.runPureEvaluationPipeline(staleRto).evaluationStatus())
                .isEqualTo(EvaluationStatus.ASSESSMENT_STALE_REFRESH_REQUIRED);

        // Dispatched (SHIPPED / DELIVERED)
        InterventionInputContext shipped = baseContextBuilder()
                .orderStatus(OrderStatus.SHIPPED)
                .dispatchLifecycleState(DispatchLifecycleState.POST_DISPATCH)
                .build();
        EvaluationOutcome postDispatchOut = engineService.runPureEvaluationPipeline(shipped);
        assertThat(postDispatchOut.evaluationStatus()).isEqualTo(EvaluationStatus.NOT_APPLICABLE_POST_DISPATCH);
        assertThat(postDispatchOut.rankedItems()).isEmpty();

        // Cancelled
        InterventionInputContext cancelled = baseContextBuilder()
                .orderStatus(OrderStatus.CANCELLED)
                .dispatchLifecycleState(DispatchLifecycleState.CANCELLED)
                .build();
        assertThat(engineService.runPureEvaluationPipeline(cancelled).evaluationStatus())
                .isEqualTo(EvaluationStatus.NOT_APPLICABLE_CANCELLED);
    }

    @Test
    void conflictingEvidenceRoutesToHighPriorityHumanReviewRankedFirst() {
        InterventionInputContext conflictCtx = baseContextBuilder()
                .orderStatus(OrderStatus.CONFIRMED)
                .codConfirmationStatus(CodConfirmationStatus.DENIED)
                .lastCallingOutcome(CallOutcome.REJECTED)
                .conflictingEvidenceIndicators(List.of("CONTRADICTORY_CONFIRMATION_AND_DENIAL_SIGNALS"))
                .rtoSnapshot(new RtoAssessmentSnapshot(82, "HIGH", 0, 27, 55, 0, List.of("CALL_DENIED_ORDER"), NOW, false))
                .build();

        EvaluationOutcome out = engineService.runPureEvaluationPipeline(conflictCtx);
        assertThat(out.rankedItems()).isNotEmpty();
        assertThat(out.rankedItems().get(0).candidate().type()).isEqualTo(InterventionType.HUMAN_REVIEW);
        assertThat(out.rankedItems().get(0).candidate().priority()).isEqualTo(InterventionPriority.HIGH);
        assertThat(out.rankedItems().get(0).candidate().triggeredRuleIds()).contains("NBIE-REVIEW-001");
    }

    @Test
    void deduplicationAndIdempotencyFingerprintTrackRulesetAndMaterialChanges() {
        CandidateIntervention dup1 = new CandidateIntervention(
                InterventionType.HUMAN_REVIEW,
                InterventionPriority.MEDIUM,
                InterventionChannel.INTERNAL_QUEUE,
                List.of("NBIE-REVIEW-002"),
                List.of("HIGH_RTO_RISK_BAND"),
                "Reason A.",
                List.of("operator_manual_review"),
                true);
        CandidateIntervention dup2 = new CandidateIntervention(
                InterventionType.HUMAN_REVIEW,
                InterventionPriority.HIGH,
                InterventionChannel.INTERNAL_QUEUE,
                List.of("NBIE-REVIEW-001"),
                List.of("CONFLICTING_EVIDENCE"),
                "Reason B.",
                List.of("operator_evidence_reconciliation"),
                true);

        var ranked = rankingService.rankAndDeduplicate(List.of(dup1, dup2));
        assertThat(ranked).hasSize(1);
        assertThat(ranked.get(0).candidate().priority()).isEqualTo(InterventionPriority.HIGH);
        assertThat(ranked.get(0).candidate().triggeredRuleIds()).containsExactly("NBIE-REVIEW-002", "NBIE-REVIEW-001");

        InterventionInputContext ctx1 = baseContextBuilder().build();
        String fp1 = InterventionEngineService.computeEvidenceFingerprint(ctx1, "NBIE_RULESET_V1");
        String fpSame = InterventionEngineService.computeEvidenceFingerprint(ctx1, "NBIE_RULESET_V1");
        String fpNewRuleset = InterventionEngineService.computeEvidenceFingerprint(ctx1, "NBIE_RULESET_V2");

        assertThat(fp1).isEqualTo(fpSame);
        assertThat(fp1).isNotEqualTo(fpNewRuleset);
    }

    private static Builder baseContextBuilder() {
        return new Builder();
    }

    private static final class Builder {
        private final UUID merchantId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        private final UUID orderId = UUID.fromString("22222222-2222-2222-2222-222222222222");
        private final UUID customerId = UUID.fromString("33333333-3333-3333-3333-333333333333");
        private BigDecimal orderValue = new BigDecimal("1499.00");
        private PaymentMethod paymentMethod = PaymentMethod.COD;
        private PaymentStatus paymentStatus = PaymentStatus.PENDING;
        private OrderStatus orderStatus = OrderStatus.CREATED;
        private DispatchLifecycleState dispatchLifecycleState = DispatchLifecycleState.PRE_DISPATCH;
        private int priorOrderCount = 1;
        private int priorCancelledBeforeDispatchCount = 0;
        private boolean coldStartCustomer = false;
        private AddressCompletenessState addressCompleteness = AddressCompletenessState.COMPLETE;
        private PinValidityState pinValidityState = PinValidityState.VALID;
        private LandmarkPresence landmarkPresence = LandmarkPresence.PRESENT;
        private List<String> missingAddressFields = Collections.emptyList();
        private CodConfirmationStatus codConfirmationStatus = CodConfirmationStatus.PENDING;
        private CallOutcome lastCallingOutcome = null;
        private int callingAttemptCount = 0;
        private int maxCallingAttempts = 3;
        private ConsentStatus consentStatus = ConsentStatus.GRANTED;
        private boolean dncOptedOut = false;
        private Set<InterventionChannel> permittedCustomerChannels = EnumSet.of(InterventionChannel.VOICE_SANDBOX);
        private int orderContactCount = 0;
        private RtoAssessmentSnapshot rtoSnapshot = new RtoAssessmentSnapshot(
                34, "MEDIUM", 0, 34, 0, 0, List.of("CONFIRMATION_PENDING"), NOW, false);
        private MerchantPolicySnapshot policy = new MerchantPolicySnapshot(
                true, true, true, true,
                false, false,
                new BigDecimal("2500.00"),
                BigDecimal.ZERO,
                EnumSet.of(InterventionChannel.VOICE_SANDBOX),
                3, 3, 2, 24, 60, true);
        private List<String> conflictingEvidenceIndicators = Collections.emptyList();

        Builder orderValue(BigDecimal v) { this.orderValue = v; return this; }
        Builder paymentMethod(PaymentMethod v) { this.paymentMethod = v; return this; }
        Builder paymentStatus(PaymentStatus v) { this.paymentStatus = v; return this; }
        Builder orderStatus(OrderStatus v) { this.orderStatus = v; return this; }
        Builder dispatchLifecycleState(DispatchLifecycleState v) { this.dispatchLifecycleState = v; return this; }
        Builder priorOrderCount(int v) { this.priorOrderCount = v; return this; }
        Builder priorCancelledBeforeDispatchCount(int v) { this.priorCancelledBeforeDispatchCount = v; return this; }
        Builder coldStartCustomer(boolean v) { this.coldStartCustomer = v; return this; }
        Builder addressCompleteness(AddressCompletenessState v) { this.addressCompleteness = v; return this; }
        Builder pinValidityState(PinValidityState v) { this.pinValidityState = v; return this; }
        Builder landmarkPresence(LandmarkPresence v) { this.landmarkPresence = v; return this; }
        Builder missingAddressFields(List<String> v) { this.missingAddressFields = v; return this; }
        Builder codConfirmationStatus(CodConfirmationStatus v) { this.codConfirmationStatus = v; return this; }
        Builder lastCallingOutcome(CallOutcome v) { this.lastCallingOutcome = v; return this; }
        Builder callingAttemptCount(int v) { this.callingAttemptCount = v; return this; }
        Builder maxCallingAttempts(int v) { this.maxCallingAttempts = v; return this; }
        Builder consentStatus(ConsentStatus v) { this.consentStatus = v; return this; }
        Builder dncOptedOut(boolean v) { this.dncOptedOut = v; return this; }
        Builder permittedCustomerChannels(Set<InterventionChannel> v) { this.permittedCustomerChannels = v; return this; }
        Builder orderContactCount(int v) { this.orderContactCount = v; return this; }
        Builder rtoSnapshot(RtoAssessmentSnapshot v) { this.rtoSnapshot = v; return this; }
        Builder policy(MerchantPolicySnapshot v) { this.policy = v; return this; }
        Builder conflictingEvidenceIndicators(List<String> v) { this.conflictingEvidenceIndicators = v; return this; }

        InterventionInputContext build() {
            return new InterventionInputContext(
                    merchantId,
                    orderId,
                    "ORD-UNIT-1",
                    customerId,
                    orderValue,
                    "INR",
                    paymentMethod,
                    paymentStatus,
                    orderStatus,
                    dispatchLifecycleState,
                    NOW.minusMinutes(10),
                    NOW.minusMinutes(5),
                    priorOrderCount,
                    priorOrderCount > 0 ? 1 : 0,
                    null,
                    priorCancelledBeforeDispatchCount,
                    0,
                    null,
                    coldStartCustomer,
                    AddressSignalExtractor.FORMULA_VERSION,
                    addressCompleteness,
                    pinValidityState,
                    landmarkPresence,
                    missingAddressFields,
                    true,
                    codConfirmationStatus,
                    lastCallingOutcome,
                    CallSessionStatus.QUEUED,
                    callingAttemptCount,
                    maxCallingAttempts,
                    null,
                    false,
                    consentStatus,
                    "UNIT_TEST",
                    dncOptedOut,
                    permittedCustomerChannels,
                    "hi-IN",
                    true,
                    false,
                    orderContactCount,
                    0,
                    null,
                    rtoSnapshot,
                    policy,
                    Collections.emptySet(),
                    Collections.emptySet(),
                    Collections.emptyList(),
                    EvidenceCompleteness.HIGH,
                    conflictingEvidenceIndicators,
                    Collections.emptyList(),
                    Collections.emptyList(),
                    NOW);
        }
    }
}
