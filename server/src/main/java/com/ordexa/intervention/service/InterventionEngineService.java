package com.ordexa.intervention.service;

import com.ordexa.calling.service.CallingDndPolicy;
import com.ordexa.customer.entity.Customer;
import com.ordexa.intervention.assembler.InterventionInputAssembler;
import com.ordexa.intervention.assembler.InterventionInputAssembler.AssembledOrderBundle;
import com.ordexa.intervention.assembler.InterventionInputContext;
import com.ordexa.intervention.assembler.InterventionInputContext.RtoAssessmentSnapshot;
import com.ordexa.intervention.dto.InterventionDtos.RecommendationResponseDto;
import com.ordexa.intervention.dto.InterventionDtos.RecommendedActionDto;
import com.ordexa.intervention.dto.InterventionDtos.RiskSnapshotDto;
import com.ordexa.intervention.entity.InterventionRecommendation;
import com.ordexa.intervention.entity.InterventionRecommendationItem;
import com.ordexa.intervention.model.EvaluationStatus;
import com.ordexa.intervention.model.InterventionEnums.DispatchLifecycleState;
import com.ordexa.intervention.model.InterventionEnums.EvidenceCompleteness;
import com.ordexa.intervention.model.InterventionEnums.InterventionItemRole;
import com.ordexa.intervention.model.InterventionStatus;
import com.ordexa.intervention.model.InterventionType;
import com.ordexa.intervention.repository.InterventionRecommendationRepository;
import com.ordexa.intervention.rules.InterventionRuleEvaluator;
import com.ordexa.intervention.rules.InterventionRuleEvaluator.CandidateIntervention;
import com.ordexa.intervention.service.InterventionFeasibilityService.FeasibilityResult;
import com.ordexa.intervention.service.InterventionRankingService.RankedIntervention;
import com.ordexa.order.entity.Order;
import com.ordexa.tenant.context.TenantContext;
import com.ordexa.tenant.context.TenantContextHolder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Core NBIE evaluation orchestrator.
 *
 * Authority Invariant:
 *   NBIE evaluates evidence and persists explainable intervention recommendations ONLY.
 *   It NEVER mutates {@code Order}, {@code PaymentStatus}, {@code OrderStatus}, or inventory/shipment state.
 */
@Service
public class InterventionEngineService {

    public static final String AUTHORITY_NOTICE =
            "NBIE recommends pre-dispatch interventions only. It never approves, declines, cancels, holds, "
                    + "or releases an order. Approving an action authorizes that intervention only.";

    private final InterventionInputAssembler inputAssembler;
    private final InterventionRuleEvaluator ruleEvaluator;
    private final InterventionFeasibilityService feasibilityService;
    private final InterventionRankingService rankingService;
    private final InterventionRecommendationRepository recommendationRepository;
    private final InterventionAuditService auditService;
    private final Clock clock;

    public InterventionEngineService(
            InterventionInputAssembler inputAssembler,
            InterventionRuleEvaluator ruleEvaluator,
            InterventionFeasibilityService feasibilityService,
            InterventionRankingService rankingService,
            InterventionRecommendationRepository recommendationRepository,
            InterventionAuditService auditService,
            Clock clock) {
        this.inputAssembler = inputAssembler;
        this.ruleEvaluator = ruleEvaluator;
        this.feasibilityService = feasibilityService;
        this.rankingService = rankingService;
        this.recommendationRepository = recommendationRepository;
        this.auditService = auditService;
        this.clock = clock;
    }

    @Transactional
    public RecommendationResponseDto evaluateForActiveMerchant(UUID orderId, boolean forceRefresh, String clientIp) {
        TenantContext tenant = TenantContextHolder.requireActiveWorkspace();
        return evaluateInternal(
                tenant.merchantId(),
                orderId,
                tenant.userId(),
                tenant.fullName(),
                forceRefresh,
                clientIp);
    }

    @Transactional
    public RecommendationResponseDto evaluateSystemEvent(UUID merchantId, UUID orderId) {
        return evaluateInternal(merchantId, orderId, null, "SYSTEM_EVENT", false, null);
    }

    @Transactional
    public RecommendationResponseDto evaluateInternal(
            UUID merchantId,
            UUID orderId,
            UUID actorUserId,
            String actorLabel,
            boolean forceRefresh,
            String clientIp) {

        AssembledOrderBundle bundle = inputAssembler.assembleForOrder(merchantId, orderId);
        return evaluateAssembledBundle(
                bundle.order(),
                bundle.customer(),
                bundle.context(),
                actorUserId,
                actorLabel,
                forceRefresh,
                clientIp);
    }

    @Transactional
    public RecommendationResponseDto evaluateAssembledBundle(
            Order order,
            Customer customer,
            InterventionInputContext ctx,
            UUID actorUserId,
            String actorLabel,
            boolean forceRefresh,
            String clientIp) {

        OffsetDateTime now = OffsetDateTime.now(clock);
        String rulesetVersion = ruleEvaluator.activeRulesetVersion();
        UUID merchantId = ctx.merchantId();

        // Expire any past-due active recommendations first
        List<InterventionRecommendation> existingActives =
                recommendationRepository.findActiveByMerchantIdAndOrderId(merchantId, order.getId());
        for (InterventionRecommendation existing : existingActives) {
            existing.markExpiredIfPastDue(now);
            if (!existing.isActiveRecord()) {
                recommendationRepository.save(existing);
            }
        }

        // Compute deterministic fingerprint of ruleset + canonical evidence state
        String fingerprint = computeEvidenceFingerprint(ctx, rulesetVersion);

        if (!forceRefresh) {
            for (InterventionRecommendation existing : existingActives) {
                if (existing.isActiveRecord()
                        && existing.getIdempotencyFingerprint().equals(fingerprint)
                        && existing.getRulesetVersion().equals(rulesetVersion)) {
                    return toResponseDto(existing);
                }
            }
        }

        // Determine evaluation status and ranked items
        EvaluationOutcome outcome = runPureEvaluationPipeline(ctx);

        int ttlHours = Math.max(1, ctx.policy().recommendationTtlHours());
        OffsetDateTime expiresAt = now.plusHours(ttlHours);

        RtoAssessmentSnapshot rto = ctx.rtoSnapshot();
        String joinedRtoReasons = (rto != null && rto.reasonCodes() != null && !rto.reasonCodes().isEmpty())
                ? String.join(",", rto.reasonCodes())
                : null;

        Map<String, Object> snapshotMap = buildMinimizedEvidenceSnapshot(ctx, outcome);

        InterventionRecommendation newRec = new InterventionRecommendation(
                UUID.randomUUID(),
                merchantId,
                order,
                customer,
                outcome.overallStatus(),
                outcome.evaluationStatus(),
                rulesetVersion,
                fingerprint,
                rto != null ? rto.score() : null,
                rto != null ? rto.band() : null,
                joinedRtoReasons,
                rto != null ? rto.assessedAt() : null,
                ctx.evidenceCompleteness(),
                snapshotMap,
                now,
                expiresAt);

        for (RankedIntervention ranked : outcome.rankedItems()) {
            CandidateIntervention c = ranked.candidate();
            InterventionStatus itemInitialStatus = determineInitialItemStatus(c);
            InterventionRecommendationItem itemEntity = new InterventionRecommendationItem(
                    UUID.randomUUID(),
                    merchantId,
                    newRec,
                    c.type(),
                    ranked.role(),
                    ranked.rankOrder(),
                    c.priority(),
                    itemInitialStatus,
                    c.proposedChannel(),
                    String.join(",", c.triggeredRuleIds()),
                    String.join(",", c.reasonCodes()),
                    c.explanation(),
                    c.requiredEvidence() != null && !c.requiredEvidence().isEmpty()
                            ? String.join(",", c.requiredEvidence())
                            : null,
                    c.approvalRequired());
            newRec.addItem(itemEntity);
        }

        InterventionRecommendation saved = recommendationRepository.save(newRec);

        // Supersede previous active recommendations on material evidence or ruleset change
        for (InterventionRecommendation prev : existingActives) {
            if (prev.isActiveRecord() && !prev.getId().equals(saved.getId())) {
                prev.markSupersededBy(saved.getId());
                recommendationRepository.save(prev);
            }
        }

        Map<String, Object> auditMeta = new LinkedHashMap<>();
        auditMeta.put("evaluationStatus", saved.getEvaluationStatus().name());
        auditMeta.put("recommendationStatus", saved.getStatus().name());
        auditMeta.put("itemCount", saved.getItems().size());
        if (!saved.getItems().isEmpty()) {
            auditMeta.put("primaryType", saved.getItems().get(0).getInterventionType().name());
        }

        auditService.appendEvent(
                merchantId,
                order.getId(),
                saved.getId(),
                saved.getItems().isEmpty() ? null : saved.getItems().get(0).getId(),
                actorUserId,
                actorLabel,
                "RECOMMENDATION_EVALUATED",
                rulesetVersion,
                "Evaluated NBIE recommendation for order " + order.getOrderNumber()
                        + " -> " + saved.getEvaluationStatus() + " (" + saved.getStatus() + ")",
                auditMeta,
                clientIp);

        return toResponseDto(saved);
    }

    public record EvaluationOutcome(
            EvaluationStatus evaluationStatus,
            InterventionStatus overallStatus,
            List<RankedIntervention> rankedItems,
            FeasibilityResult feasibilityResult
    ) {
    }

    /**
     * Pure deterministic pipeline (Stages 2–7): lifecycle check, RTO freshness check,
     * rule candidate generation, feasibility filtering, contact-suppressed review fallback,
     * and ranking/deduplication.
     */
    public EvaluationOutcome runPureEvaluationPipeline(InterventionInputContext ctx) {
        // Stage 2: Lifecycle eligibility
        if (ctx.dispatchLifecycleState() == DispatchLifecycleState.POST_DISPATCH) {
            return new EvaluationOutcome(
                    EvaluationStatus.NOT_APPLICABLE_POST_DISPATCH,
                    InterventionStatus.COMPLETED,
                    Collections.emptyList(),
                    new FeasibilityResult(Collections.emptyList(), Collections.emptyList(), false, Collections.emptyList()));
        }
        if (ctx.dispatchLifecycleState() == DispatchLifecycleState.CANCELLED) {
            return new EvaluationOutcome(
                    EvaluationStatus.NOT_APPLICABLE_CANCELLED,
                    InterventionStatus.COMPLETED,
                    Collections.emptyList(),
                    new FeasibilityResult(Collections.emptyList(), Collections.emptyList(), false, Collections.emptyList()));
        }

        if (!ctx.policy().enabled()) {
            return new EvaluationOutcome(
                    EvaluationStatus.POLICY_DISABLED,
                    InterventionStatus.COMPLETED,
                    Collections.emptyList(),
                    new FeasibilityResult(Collections.emptyList(), Collections.emptyList(), false, Collections.emptyList()));
        }

        // Stage 3: Validate existing RTO assessment availability & freshness (never fabricate a band)
        RtoAssessmentSnapshot rto = ctx.rtoSnapshot();
        if (rto == null || rto.band() == null || rto.band().isBlank() || rto.assessedAt() == null) {
            return new EvaluationOutcome(
                    EvaluationStatus.ASSESSMENT_UNAVAILABLE,
                    InterventionStatus.RECOMMENDED,
                    Collections.emptyList(),
                    new FeasibilityResult(Collections.emptyList(), Collections.emptyList(), false, Collections.emptyList()));
        }

        long assessmentAgeMinutes = Duration.between(rto.assessedAt(), ctx.assembledAt()).toMinutes();
        if (rto.stale() || assessmentAgeMinutes > ctx.policy().maxRtoAssessmentAgeMinutes()) {
            return new EvaluationOutcome(
                    EvaluationStatus.ASSESSMENT_STALE_REFRESH_REQUIRED,
                    InterventionStatus.RECOMMENDED,
                    Collections.emptyList(),
                    new FeasibilityResult(Collections.emptyList(), Collections.emptyList(), false, Collections.emptyList()));
        }

        // Stage 5: Pure candidate generation
        List<CandidateIntervention> rawCandidates = ruleEvaluator.evaluateCandidates(ctx);

        // Stage 6: Feasibility, consent, opt-out, contact caps, and merchant policy filters
        FeasibilityResult feasibility = feasibilityService.filterCandidates(ctx, rawCandidates);
        List<CandidateIntervention> workingFeasible = new ArrayList<>(feasibility.feasibleCandidates());

        // Rule NBIE-REVIEW-003: If contact actions were needed for real uncertainty
        // but all contact channels were suppressed by consent/DNC/policy, route to HUMAN_REVIEW
        if (workingFeasible.isEmpty()
                && feasibility.contactCandidatesSuppressed()
                && ctx.policy().humanReviewEnabled()
                && !ctx.completedInterventionTypes().contains(InterventionType.HUMAN_REVIEW)
                && !ctx.activePendingInterventionTypes().contains(InterventionType.HUMAN_REVIEW)) {
            List<String> underlyingReasons = rawCandidates.stream()
                    .flatMap(c -> c.reasonCodes().stream())
                    .distinct()
                    .toList();
            workingFeasible.add(ruleEvaluator.buildContactSuppressedReviewFallback(
                    feasibility.contactSuppressionCodes(), underlyingReasons));
        }

        // Rule NBIE-NONE-001: If no actionable candidates apply, emit NO_INTERVENTION (not order approval)
        if (workingFeasible.isEmpty()) {
            workingFeasible.add(ruleEvaluator.buildNoInterventionBaseline(ctx));
        }

        // Stage 7: Rank & deduplicate
        List<RankedIntervention> ranked = rankingService.rankAndDeduplicate(workingFeasible);

        InterventionStatus overallStatus = InterventionStatus.RECOMMENDED;
        if (!ranked.isEmpty()) {
            CandidateIntervention primary = ranked.get(0).candidate();
            if (primary.type() == InterventionType.NO_INTERVENTION) {
                overallStatus = InterventionStatus.COMPLETED;
            } else if (primary.approvalRequired()) {
                overallStatus = InterventionStatus.ACTION_APPROVAL_PENDING;
            } else {
                overallStatus = InterventionStatus.ACTION_APPROVED;
            }
        }

        return new EvaluationOutcome(EvaluationStatus.COMPLETED, overallStatus, ranked, feasibility);
    }

    private InterventionStatus determineInitialItemStatus(CandidateIntervention c) {
        if (c.type() == InterventionType.NO_INTERVENTION) {
            return InterventionStatus.COMPLETED;
        }
        return c.approvalRequired()
                ? InterventionStatus.ACTION_APPROVAL_PENDING
                : InterventionStatus.ACTION_APPROVED;
    }

    private Map<String, Object> buildMinimizedEvidenceSnapshot(
            InterventionInputContext ctx,
            EvaluationOutcome outcome) {
        Map<String, Object> snap = new LinkedHashMap<>();
        snap.put("orderNumber", ctx.orderNumber());
        snap.put("orderStatus", ctx.orderStatus().name());
        snap.put("dispatchLifecycleState", ctx.dispatchLifecycleState().name());
        snap.put("paymentMethod", ctx.paymentMethod().name());
        snap.put("paymentStatus", ctx.paymentStatus().name());
        snap.put("orderValue", ctx.orderValue());
        snap.put("currency", ctx.currency());

        snap.put("coldStartCustomer", ctx.coldStartCustomer());
        snap.put("priorOrderCount", ctx.priorOrderCount());
        snap.put("verifiedSuccessfulDeliveryCount", ctx.verifiedSuccessfulDeliveryCount());
        snap.put("verifiedRtoCount", ctx.verifiedRtoCount());
        snap.put("priorCancelledBeforeDispatchCount", ctx.priorCancelledBeforeDispatchCount());
        snap.put("priorCodSuccessRate", ctx.priorCodSuccessRate());

        snap.put("addressFormulaVersion", ctx.addressFormulaVersion());
        snap.put("addressCompleteness", ctx.addressCompleteness().name());
        snap.put("pinValidityState", ctx.pinValidityState().name());
        snap.put("landmarkPresence", ctx.landmarkPresence().name());
        snap.put("missingAddressFields", ctx.missingAddressFields());
        snap.put("phoneRoutable", ctx.phoneRoutable());

        snap.put("codConfirmationStatus", ctx.codConfirmationStatus().name());
        snap.put("lastCallingOutcome", ctx.lastCallingOutcome() != null ? ctx.lastCallingOutcome().name() : null);
        snap.put("callingAttemptCount", ctx.callingAttemptCount());
        snap.put("callSignalStale", ctx.callSignalStale());

        snap.put("consentStatus", ctx.consentStatus().name());
        snap.put("consentSource", ctx.consentSource());
        snap.put("dncOptedOut", ctx.dncOptedOut());
        snap.put("inDndQuietWindow", ctx.inDndQuietWindow());
        snap.put("orderContactCount", ctx.orderContactCount());
        snap.put("customerContactCount24h", ctx.customerContactCount24h());

        if (ctx.rtoSnapshot() != null) {
            Map<String, Object> rtoPillarMap = new LinkedHashMap<>();
            rtoPillarMap.put("behaviouralPoints", ctx.rtoSnapshot().behaviouralPoints());
            rtoPillarMap.put("orderPoints", ctx.rtoSnapshot().orderPoints());
            rtoPillarMap.put("callingOutcomePoints", ctx.rtoSnapshot().callingOutcomePoints());
            rtoPillarMap.put("historicalConfirmationPoints", ctx.rtoSnapshot().historicalConfirmationPoints());
            snap.put("rtoPillarScores", rtoPillarMap);
        }

        snap.put("conflictingEvidenceIndicators", ctx.conflictingEvidenceIndicators());
        snap.put("unknownDataWarnings", ctx.unknownDataWarnings());
        snap.put("staleDataWarnings", ctx.staleDataWarnings());
        snap.put("droppedCandidates", outcome.feasibilityResult().droppedCandidates().stream()
                .map(d -> Map.of("type", d.type().name(), "dropCode", d.dropCode()))
                .toList());
        return snap;
    }

    public static String computeEvidenceFingerprint(InterventionInputContext ctx, String rulesetVersion) {
        String canonical = String.join("|",
                String.valueOf(ctx.merchantId()),
                String.valueOf(ctx.orderId()),
                rulesetVersion,
                ctx.orderStatus().name(),
                ctx.paymentMethod().name(),
                ctx.paymentStatus().name(),
                ctx.orderValue().toPlainString(),
                ctx.addressCompleteness().name(),
                ctx.pinValidityState().name(),
                ctx.landmarkPresence().name(),
                String.join(",", ctx.missingAddressFields()),
                ctx.codConfirmationStatus().name(),
                ctx.lastCallingOutcome() != null ? ctx.lastCallingOutcome().name() : "NONE",
                String.valueOf(ctx.callingAttemptCount()),
                String.valueOf(ctx.callSignalStale()),
                ctx.consentStatus().name(),
                String.valueOf(ctx.dncOptedOut()),
                String.valueOf(ctx.policy().enabled()),
                String.valueOf(ctx.policy().partialAdvanceEnabled()),
                String.valueOf(ctx.policy().partialAdvancePaymentCapable()),
                ctx.rtoSnapshot() != null ? ctx.rtoSnapshot().score() + ":" + ctx.rtoSnapshot().band() : "NO_RTO",
                ctx.completedInterventionTypes().toString(),
                ctx.conflictingEvidenceIndicators().toString()
        );
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(canonical.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    public RecommendationResponseDto toResponseDto(InterventionRecommendation rec) {
        Order order = rec.getOrder();
        Customer customer = rec.getCustomer();

        Map<String, Object> snap = rec.getEvidenceSnapshot() != null
                ? rec.getEvidenceSnapshot()
                : Collections.emptyMap();

        Integer behPts = null;
        Integer ordPts = null;
        Integer callPts = null;
        Integer histPts = null;
        Object rawPillars = snap.get("rtoPillarScores");
        if (rawPillars instanceof Map<?, ?> pMap) {
            behPts = toInteger(pMap.get("behaviouralPoints"));
            ordPts = toInteger(pMap.get("orderPoints"));
            callPts = toInteger(pMap.get("callingOutcomePoints"));
            histPts = toInteger(pMap.get("historicalConfirmationPoints"));
        }

        RiskSnapshotDto riskDto = rec.getRtoBand() != null
                ? new RiskSnapshotDto(
                        rec.getRtoScore(),
                        rec.getRtoBand(),
                        behPts,
                        ordPts,
                        callPts,
                        histPts,
                        splitCsv(rec.getRtoReasonCodes()),
                        rec.getRtoAssessedAt())
                : null;

        List<RecommendedActionDto> mappedItems = rec.getItems().stream()
                .map(this::toActionDto)
                .toList();

        RecommendedActionDto primary = mappedItems.stream()
                .filter(i -> i.role() == InterventionItemRole.PRIMARY)
                .findFirst()
                .orElse(mappedItems.isEmpty() ? null : mappedItems.get(0));

        List<RecommendedActionDto> secondaries = mappedItems.stream()
                .filter(i -> primary == null || !i.itemId().equals(primary.itemId()))
                .toList();

        return new RecommendationResponseDto(
                rec.getId(),
                order.getId(),
                order.getOrderNumber(),
                order.getOrderStatus(),
                order.getPaymentMethod(),
                order.getTotalAmount(),
                order.getCurrency(),
                customer.getId(),
                customer.getFullName(),
                CallingDndPolicy.maskPhone(customer.getPhoneNumber()),
                rec.getStatus(),
                rec.getEvaluationStatus(),
                riskDto,
                primary,
                secondaries,
                rec.getEvidenceCompleteness(),
                snap,
                rec.getRulesetVersion(),
                AUTHORITY_NOTICE,
                rec.isActiveRecord(),
                rec.getEvaluatedAt(),
                rec.getExpiresAt());
    }

    public RecommendedActionDto toActionDto(InterventionRecommendationItem item) {
        return new RecommendedActionDto(
                item.getId(),
                item.getItemRole(),
                item.getRankOrder(),
                item.getInterventionType(),
                item.getPriority(),
                item.getStatus(),
                item.getProposedChannel(),
                splitCsv(item.getTriggeredRuleIds()),
                splitCsv(item.getReasonCodes()),
                item.getExplanation(),
                splitCsv(item.getRequiredEvidence()),
                item.isApprovalRequired());
    }

    private static List<String> splitCsv(String csv) {
        if (csv == null || csv.isBlank()) {
            return Collections.emptyList();
        }
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    private static Integer toInteger(Object val) {
        if (val instanceof Number n) {
            return n.intValue();
        }
        return null;
    }
}
