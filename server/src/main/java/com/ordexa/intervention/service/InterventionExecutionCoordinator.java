package com.ordexa.intervention.service;

import com.ordexa.common.exception.ErrorCode;
import com.ordexa.common.exception.OrdexaException;
import com.ordexa.common.exception.ResourceNotFoundException;
import com.ordexa.intervention.adapter.InterventionExecutionAdapter;
import com.ordexa.intervention.adapter.InterventionExecutionAdapter.AdapterExecutionResult;
import com.ordexa.intervention.assembler.InterventionInputAssembler;
import com.ordexa.intervention.assembler.InterventionInputAssembler.AssembledOrderBundle;
import com.ordexa.intervention.dto.InterventionDtos.ExecuteInterventionRequest;
import com.ordexa.intervention.dto.InterventionDtos.RecommendationDetailDto;
import com.ordexa.intervention.entity.InterventionExecutionLog;
import com.ordexa.intervention.entity.InterventionRecommendation;
import com.ordexa.intervention.entity.InterventionRecommendationItem;
import com.ordexa.intervention.model.InterventionEnums.ExecutionLogStatus;
import com.ordexa.intervention.model.InterventionEnums.ExecutionProviderMode;
import com.ordexa.intervention.model.InterventionEnums.InterventionItemRole;
import com.ordexa.intervention.model.InterventionStatus;
import com.ordexa.intervention.model.InterventionType;
import com.ordexa.intervention.repository.InterventionExecutionLogRepository;
import com.ordexa.intervention.repository.InterventionRecommendationItemRepository;
import com.ordexa.intervention.repository.InterventionRecommendationRepository;
import com.ordexa.tenant.context.TenantContext;
import com.ordexa.tenant.context.TenantContextHolder;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Coordinates safe sandbox-only execution of an approved NBIE intervention item.
 *
 * Enforces:
 *   1. Explicit prior {@code ACTION_APPROVED} status.
 *   2. Idempotent execution per item / idempotencyKey.
 *   3. Real-time re-verification of consent, DNC opt-out, merchant policy, contact caps,
 *      and pre-dispatch order lifecycle immediately before adapter invocation.
 *   4. Sandbox-only execution; sandbox acknowledgment moves item to {@code OUTCOME_PENDING}
 *      (never treated as proof of customer confirmation or order approval).
 */
@Service
public class InterventionExecutionCoordinator {

    private final InterventionRecommendationItemRepository itemRepository;
    private final InterventionRecommendationRepository recommendationRepository;
    private final InterventionExecutionLogRepository executionLogRepository;
    private final InterventionInputAssembler inputAssembler;
    private final InterventionFeasibilityService feasibilityService;
    private final InterventionRecommendationService recommendationService;
    private final InterventionAuditService auditService;
    private final List<InterventionExecutionAdapter> adapters;
    private final Clock clock;

    public InterventionExecutionCoordinator(
            InterventionRecommendationItemRepository itemRepository,
            InterventionRecommendationRepository recommendationRepository,
            InterventionExecutionLogRepository executionLogRepository,
            InterventionInputAssembler inputAssembler,
            InterventionFeasibilityService feasibilityService,
            InterventionRecommendationService recommendationService,
            InterventionAuditService auditService,
            List<InterventionExecutionAdapter> adapters,
            Clock clock) {
        this.itemRepository = itemRepository;
        this.recommendationRepository = recommendationRepository;
        this.executionLogRepository = executionLogRepository;
        this.inputAssembler = inputAssembler;
        this.feasibilityService = feasibilityService;
        this.recommendationService = recommendationService;
        this.auditService = auditService;
        this.adapters = adapters;
        this.clock = clock;
    }

    @Transactional
    public RecommendationDetailDto executeApprovedItem(
            UUID itemId,
            ExecuteInterventionRequest request,
            String clientIp) {

        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        InterventionRecommendationItem item = itemRepository
                .findByIdAndMerchantIdWithRecommendation(itemId, ctx.merchantId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Intervention recommendation item not found in active merchant workspace"));

        InterventionRecommendation rec = item.getRecommendation();
        OffsetDateTime now = OffsetDateTime.now(clock);

        if (item.getInterventionType() == InterventionType.NO_INTERVENTION) {
            throw new OrdexaException(
                    "NO_INTERVENTION cannot be executed",
                    ErrorCode.INTERVENTION_ACTION_NOT_ALLOWED,
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }

        String resolvedIdempKey = (request != null && request.idempotencyKey() != null && !request.idempotencyKey().isBlank())
                ? "nbie-exec:" + ctx.merchantId() + ":" + request.idempotencyKey().trim()
                : "nbie-exec:" + ctx.merchantId() + ":item:" + item.getId();

        // Idempotent replay check
        Optional<InterventionExecutionLog> existingExec = executionLogRepository.findByIdempotencyKey(resolvedIdempKey);
        if (existingExec.isPresent()) {
            return recommendationService.loadDetailForMerchant(ctx.merchantId(), rec.getId());
        }

        if (item.getStatus() == InterventionStatus.EXECUTED
                || item.getStatus() == InterventionStatus.OUTCOME_PENDING
                || item.getStatus() == InterventionStatus.COMPLETED) {
            return recommendationService.loadDetailForMerchant(ctx.merchantId(), rec.getId());
        }

        if (item.getStatus() != InterventionStatus.ACTION_APPROVED
                && item.getStatus() != InterventionStatus.EXECUTION_PENDING) {
            throw new OrdexaException(
                    "Intervention action must be explicitly approved (ACTION_APPROVED) before execution (current status: "
                            + item.getStatus() + ")",
                    ErrorCode.INTERVENTION_ACTION_NOT_ALLOWED,
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }

        rec.markExpiredIfPastDue(now);
        if (rec.getStatus() == InterventionStatus.EXPIRED || rec.getStatus() == InterventionStatus.SUPERSEDED) {
            recommendationRepository.save(rec);
            throw new OrdexaException(
                    "Cannot execute an expired or superseded recommendation; please refresh first",
                    ErrorCode.INTERVENTION_ACTION_NOT_ALLOWED,
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }

        // Re-verify consent, DNC, lifecycle, and merchant policy at execution time
        AssembledOrderBundle freshBundle = inputAssembler.assembleForOrder(ctx.merchantId(), rec.getOrder().getId());
        String blockCode = feasibilityService.verifyExecutionEligibility(
                freshBundle.context(), item.getInterventionType(), item.getProposedChannel());

        if (blockCode != null) {
            boolean consentRelated = blockCode.contains("CONSENT") || blockCode.contains("DNC");
            ExecutionLogStatus logStatus = consentRelated
                    ? ExecutionLogStatus.BLOCKED_CONSENT
                    : ExecutionLogStatus.BLOCKED_POLICY;

            executionLogRepository.save(new InterventionExecutionLog(
                    ctx.merchantId(),
                    rec.getId(),
                    item.getId(),
                    resolvedIdempKey + ":blocked:" + UUID.randomUUID(),
                    "EXECUTION_GUARD",
                    item.getProposedChannel(),
                    ExecutionProviderMode.SANDBOX,
                    logStatus,
                    null,
                    Map.of("blockCode", blockCode, "interventionType", item.getInterventionType().name()),
                    ctx.userId(),
                    now));

            auditService.appendEvent(
                    ctx.merchantId(),
                    rec.getOrder().getId(),
                    rec.getId(),
                    item.getId(),
                    ctx.userId(),
                    ctx.fullName(),
                    "INTERVENTION_EXECUTION_BLOCKED",
                    rec.getRulesetVersion(),
                    "Blocked NBIE execution for " + item.getInterventionType() + " due to " + blockCode,
                    Map.of("blockCode", blockCode, "interventionType", item.getInterventionType().name()),
                    clientIp);

            throw new OrdexaException(
                    "Intervention execution blocked at runtime verification: " + blockCode,
                    consentRelated ? ErrorCode.CONSENT_REQUIRED : ErrorCode.POLICY_RESTRICTION,
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }

        InterventionExecutionAdapter adapter = adapters.stream()
                .filter(a -> a.supports(item.getProposedChannel()))
                .findFirst()
                .orElseThrow(() -> new OrdexaException(
                        "No sandbox execution adapter registered for channel " + item.getProposedChannel(),
                        ErrorCode.POLICY_RESTRICTION,
                        HttpStatus.UNPROCESSABLE_ENTITY));

        item.setStatus(InterventionStatus.EXECUTING);
        AdapterExecutionResult result = adapter.executeSandbox(freshBundle.order(), item, resolvedIdempKey);

        InterventionExecutionLog savedLog = executionLogRepository.save(new InterventionExecutionLog(
                ctx.merchantId(),
                rec.getId(),
                item.getId(),
                resolvedIdempKey,
                adapter.adapterCode(),
                item.getProposedChannel(),
                result.providerMode(),
                result.status(),
                result.externalReferenceId(),
                InterventionAuditService.sanitizeMetadata(result.sanitizedMetadata()),
                ctx.userId(),
                now));

        // Sandbox acceptance means execution dispatched — outcome is still pending!
        InterventionStatus postExecStatus = result.accepted()
                ? InterventionStatus.OUTCOME_PENDING
                : InterventionStatus.FAILED;

        item.setStatus(postExecStatus);
        itemRepository.save(item);

        if (item.getItemRole() == InterventionItemRole.PRIMARY) {
            rec.setStatus(postExecStatus);
            recommendationRepository.save(rec);
        }

        auditService.appendEvent(
                ctx.merchantId(),
                rec.getOrder().getId(),
                rec.getId(),
                item.getId(),
                ctx.userId(),
                ctx.fullName(),
                "INTERVENTION_EXECUTED_SANDBOX",
                rec.getRulesetVersion(),
                "Executed intervention " + item.getInterventionType() + " via " + adapter.adapterCode()
                        + " in " + result.providerMode() + " mode (awaiting verified outcome; order unchanged)",
                Map.of(
                        "executionId", savedLog.getId().toString(),
                        "adapterCode", adapter.adapterCode(),
                        "providerMode", result.providerMode().name(),
                        "status", postExecStatus.name(),
                        "orderMutated", false),
                clientIp);

        return recommendationService.loadDetailForMerchant(ctx.merchantId(), rec.getId());
    }
}
