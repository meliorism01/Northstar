package com.ordexa.intervention.service;

import com.ordexa.common.exception.ErrorCode;
import com.ordexa.common.exception.OrdexaException;
import com.ordexa.common.exception.ResourceNotFoundException;
import com.ordexa.intervention.dto.InterventionDtos.RecommendationDetailDto;
import com.ordexa.intervention.dto.InterventionDtos.RecommendationResponseDto;
import com.ordexa.intervention.dto.InterventionDtos.RecordOutcomeRequest;
import com.ordexa.intervention.entity.InterventionOutcome;
import com.ordexa.intervention.entity.InterventionRecommendation;
import com.ordexa.intervention.entity.InterventionRecommendationItem;
import com.ordexa.intervention.model.InterventionEnums.InterventionItemRole;
import com.ordexa.intervention.model.InterventionEnums.InterventionOutcomeType;
import com.ordexa.intervention.model.InterventionStatus;
import com.ordexa.intervention.repository.InterventionOutcomeRepository;
import com.ordexa.intervention.repository.InterventionRecommendationItemRepository;
import com.ordexa.intervention.repository.InterventionRecommendationRepository;
import com.ordexa.tenant.context.TenantContext;
import com.ordexa.tenant.context.TenantContextHolder;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Records minimized, structured intervention outcomes without mutating order status
 * and without inferring fraud from non-response.
 *
 * When a verified customer outcome resolves or changes pre-dispatch evidence (and
 * {@code triggerReEvaluation} is not false), NBIE re-evaluates the order safely.
 */
@Service
public class InterventionOutcomeService {

    private final InterventionRecommendationItemRepository itemRepository;
    private final InterventionRecommendationRepository recommendationRepository;
    private final InterventionOutcomeRepository outcomeRepository;
    private final InterventionEngineService engineService;
    private final InterventionRecommendationService recommendationService;
    private final InterventionAuditService auditService;
    private final Clock clock;

    public InterventionOutcomeService(
            InterventionRecommendationItemRepository itemRepository,
            InterventionRecommendationRepository recommendationRepository,
            InterventionOutcomeRepository outcomeRepository,
            InterventionEngineService engineService,
            InterventionRecommendationService recommendationService,
            InterventionAuditService auditService,
            Clock clock) {
        this.itemRepository = itemRepository;
        this.recommendationRepository = recommendationRepository;
        this.outcomeRepository = outcomeRepository;
        this.engineService = engineService;
        this.recommendationService = recommendationService;
        this.auditService = auditService;
        this.clock = clock;
    }

    @Transactional
    public RecommendationDetailDto recordOutcome(
            UUID itemId,
            RecordOutcomeRequest request,
            String clientIp) {

        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        InterventionRecommendationItem item = itemRepository
                .findByIdAndMerchantIdWithRecommendation(itemId, ctx.merchantId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Intervention recommendation item not found in active merchant workspace"));

        InterventionRecommendation rec = item.getRecommendation();
        OffsetDateTime now = OffsetDateTime.now(clock);

        InterventionOutcomeType outcomeType = request.outcomeType();
        String resolvedIdempKey = (request.idempotencyKey() != null && !request.idempotencyKey().isBlank())
                ? "nbie-outcome:" + ctx.merchantId() + ":" + request.idempotencyKey().trim()
                : "nbie-outcome:" + ctx.merchantId() + ":" + item.getId() + ":" + outcomeType.name();

        Optional<InterventionOutcome> existingOutcome = outcomeRepository.findByIdempotencyKey(resolvedIdempKey);
        if (existingOutcome.isPresent()) {
            return recommendationService.loadDetailForMerchant(ctx.merchantId(), rec.getId());
        }

        if (item.getStatus() != InterventionStatus.EXECUTED
                && item.getStatus() != InterventionStatus.OUTCOME_PENDING
                && item.getStatus() != InterventionStatus.ACTION_APPROVED) {
            throw new OrdexaException(
                    "Outcomes can only be recorded for approved or executed intervention items (current status: "
                            + item.getStatus() + ")",
                    ErrorCode.INTERVENTION_ACTION_NOT_ALLOWED,
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }

        String source = (request.outcomeSource() != null && !request.outcomeSource().isBlank())
                ? request.outcomeSource().trim()
                : "OPERATOR_RECORDED";

        Map<String, Object> minimizedPayload = new LinkedHashMap<>();
        minimizedPayload.put("interventionType", item.getInterventionType().name());
        minimizedPayload.put("outcomeType", outcomeType.name());
        minimizedPayload.put("verifiedResponse", outcomeType.isVerifiedResponse());
        if (request.resolvedFields() != null && !request.resolvedFields().isEmpty()) {
            minimizedPayload.put("resolvedFields", request.resolvedFields());
        }
        if (!outcomeType.isVerifiedResponse()) {
            minimizedPayload.put("interpretationNote",
                    "Inconclusive or unanswered outcome is NOT proof of fraud, rejection, or confirmation.");
        }

        InterventionOutcome savedOutcome = outcomeRepository.save(new InterventionOutcome(
                ctx.merchantId(),
                rec.getId(),
                item.getId(),
                resolvedIdempKey,
                outcomeType,
                source,
                outcomeType.isVerifiedResponse(),
                InterventionAuditService.sanitizeMetadata(minimizedPayload),
                ctx.userId(),
                now));

        // Verified outcomes mark the intervention item COMPLETED; inconclusive outcomes remain OUTCOME_PENDING
        InterventionStatus nextItemStatus = outcomeType.isVerifiedResponse()
                ? InterventionStatus.COMPLETED
                : InterventionStatus.OUTCOME_PENDING;

        item.setStatus(nextItemStatus);
        itemRepository.save(item);

        if (item.getItemRole() == InterventionItemRole.PRIMARY) {
            rec.setStatus(nextItemStatus);
            recommendationRepository.save(rec);
        }

        auditService.appendEvent(
                ctx.merchantId(),
                rec.getOrder().getId(),
                rec.getId(),
                item.getId(),
                ctx.userId(),
                ctx.fullName(),
                "INTERVENTION_OUTCOME_RECORDED",
                rec.getRulesetVersion(),
                "Recorded outcome " + outcomeType.name()
                        + " (verified=" + outcomeType.isVerifiedResponse()
                        + ") for order " + rec.getOrder().getOrderNumber() + " (order status unchanged)",
                Map.of(
                        "outcomeId", savedOutcome.getId().toString(),
                        "outcomeType", outcomeType.name(),
                        "verifiedResponse", outcomeType.isVerifiedResponse(),
                        "orderMutated", false),
                clientIp);

        boolean shouldRefresh = Boolean.TRUE.equals(request.triggerReEvaluation());
        if (shouldRefresh) {
            RecommendationResponseDto refreshed = engineService.evaluateInternal(
                    ctx.merchantId(),
                    rec.getOrder().getId(),
                    ctx.userId(),
                    ctx.fullName(),
                    true,
                    clientIp);
            return recommendationService.loadDetailForMerchant(ctx.merchantId(), refreshed.recommendationId());
        }

        return recommendationService.loadDetailForMerchant(ctx.merchantId(), rec.getId());
    }
}
