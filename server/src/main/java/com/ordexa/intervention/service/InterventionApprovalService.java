package com.ordexa.intervention.service;

import com.ordexa.common.exception.ErrorCode;
import com.ordexa.common.exception.OrdexaException;
import com.ordexa.common.exception.ResourceNotFoundException;
import com.ordexa.intervention.dto.InterventionDtos.ActionDecisionRequest;
import com.ordexa.intervention.dto.InterventionDtos.RecommendationDetailDto;
import com.ordexa.intervention.entity.InterventionApproval;
import com.ordexa.intervention.entity.InterventionRecommendation;
import com.ordexa.intervention.entity.InterventionRecommendationItem;
import com.ordexa.intervention.model.InterventionEnums.ApprovalDecision;
import com.ordexa.intervention.model.InterventionEnums.InterventionItemRole;
import com.ordexa.intervention.model.InterventionStatus;
import com.ordexa.intervention.model.InterventionType;
import com.ordexa.intervention.repository.InterventionApprovalRepository;
import com.ordexa.intervention.repository.InterventionRecommendationItemRepository;
import com.ordexa.intervention.repository.InterventionRecommendationRepository;
import com.ordexa.tenant.context.TenantContext;
import com.ordexa.tenant.context.TenantContextHolder;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Handles merchant operator approval or rejection of a recommended INTERVENTION ACTION ONLY.
 *
 * CRITICAL AUTHORITY INVARIANT:
 *   - Approving an item sets item status to {@code ACTION_APPROVED} (authorizing execution of the
 *     intervention). It NEVER approves or releases the order.
 *   - Rejecting an item sets item status to {@code ACTION_REJECTED} (declining to perform that
 *     intervention). It NEVER rejects, cancels, or holds the order.
 *   - {@code OrderRepository} is intentionally NOT injected into this service.
 */
@Service
public class InterventionApprovalService {

    private final InterventionRecommendationItemRepository itemRepository;
    private final InterventionRecommendationRepository recommendationRepository;
    private final InterventionApprovalRepository approvalRepository;
    private final InterventionRecommendationService recommendationService;
    private final InterventionAuditService auditService;
    private final Clock clock;

    public InterventionApprovalService(
            InterventionRecommendationItemRepository itemRepository,
            InterventionRecommendationRepository recommendationRepository,
            InterventionApprovalRepository approvalRepository,
            InterventionRecommendationService recommendationService,
            InterventionAuditService auditService,
            Clock clock) {
        this.itemRepository = itemRepository;
        this.recommendationRepository = recommendationRepository;
        this.approvalRepository = approvalRepository;
        this.recommendationService = recommendationService;
        this.auditService = auditService;
        this.clock = clock;
    }

    @Transactional
    public RecommendationDetailDto approveAction(
            UUID itemId,
            ActionDecisionRequest request,
            String clientIp) {
        return decideOnAction(itemId, ApprovalDecision.ACTION_APPROVED, request, clientIp);
    }

    @Transactional
    public RecommendationDetailDto rejectAction(
            UUID itemId,
            ActionDecisionRequest request,
            String clientIp) {
        return decideOnAction(itemId, ApprovalDecision.ACTION_REJECTED, request, clientIp);
    }

    private RecommendationDetailDto decideOnAction(
            UUID itemId,
            ApprovalDecision decision,
            ActionDecisionRequest request,
            String clientIp) {

        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        InterventionRecommendationItem item = itemRepository
                .findByIdAndMerchantIdWithRecommendation(itemId, ctx.merchantId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Intervention recommendation item not found in active merchant workspace"));

        InterventionRecommendation rec = item.getRecommendation();
        OffsetDateTime now = OffsetDateTime.now(clock);
        rec.markExpiredIfPastDue(now);
        if (rec.getStatus() == InterventionStatus.EXPIRED || rec.getStatus() == InterventionStatus.SUPERSEDED) {
            recommendationRepository.save(rec);
            throw new OrdexaException(
                    "Cannot modify action on an expired or superseded recommendation; please refresh first",
                    ErrorCode.INTERVENTION_ACTION_NOT_ALLOWED,
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }

        if (item.getInterventionType() == InterventionType.NO_INTERVENTION) {
            throw new OrdexaException(
                    "NO_INTERVENTION requires no action approval or rejection",
                    ErrorCode.INTERVENTION_ACTION_NOT_ALLOWED,
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }

        InterventionStatus targetStatus = decision == ApprovalDecision.ACTION_APPROVED
                ? InterventionStatus.ACTION_APPROVED
                : InterventionStatus.ACTION_REJECTED;

        // Idempotent handling if same decision was already recorded
        if (item.getStatus() == targetStatus) {
            return recommendationService.loadDetailForMerchant(ctx.merchantId(), rec.getId());
        }

        if (!item.getStatus().canTransitionTo(targetStatus)) {
            throw new OrdexaException(
                    "Invalid intervention action status transition from "
                            + item.getStatus() + " to " + targetStatus,
                    ErrorCode.INVALID_STATUS_TRANSITION,
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }

        String cleanNote = (request != null && request.note() != null && !request.note().isBlank())
                ? request.note().trim()
                : null;

        item.setStatus(targetStatus);
        itemRepository.save(item);

        if (item.getItemRole() == InterventionItemRole.PRIMARY) {
            rec.setStatus(targetStatus);
            recommendationRepository.save(rec);
        }

        approvalRepository.save(new InterventionApproval(
                ctx.merchantId(),
                rec.getId(),
                item.getId(),
                ctx.userId(),
                ctx.role().name(),
                decision,
                cleanNote,
                now));

        String eventType = decision == ApprovalDecision.ACTION_APPROVED
                ? "INTERVENTION_ACTION_APPROVED"
                : "INTERVENTION_ACTION_REJECTED";

        auditService.appendEvent(
                ctx.merchantId(),
                rec.getOrder().getId(),
                rec.getId(),
                item.getId(),
                ctx.userId(),
                ctx.fullName(),
                eventType,
                rec.getRulesetVersion(),
                (decision == ApprovalDecision.ACTION_APPROVED ? "Approved intervention action " : "Rejected intervention action ")
                        + item.getInterventionType() + " for order " + rec.getOrder().getOrderNumber()
                        + " (order status remains unchanged: " + rec.getOrder().getOrderStatus() + ")",
                Map.of(
                        "interventionType", item.getInterventionType().name(),
                        "decision", decision.name(),
                        "orderMutated", false),
                clientIp);

        return recommendationService.loadDetailForMerchant(ctx.merchantId(), rec.getId());
    }
}
