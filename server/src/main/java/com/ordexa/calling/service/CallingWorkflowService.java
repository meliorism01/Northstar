package com.ordexa.calling.service;

import com.ordexa.auth.entity.AuditLog;
import com.ordexa.auth.token.AuditLogRepository;
import com.ordexa.calling.config.CallingProperties;
import com.ordexa.calling.dto.CallingDtos.CallAttemptDto;
import com.ordexa.calling.dto.CallingDtos.CallEventDto;
import com.ordexa.calling.dto.CallingDtos.CallQueueItemDto;
import com.ordexa.calling.dto.CallingDtos.CallSessionDetailDto;
import com.ordexa.calling.dto.CallingDtos.CallTranscriptTurnDto;
import com.ordexa.calling.dto.CallingDtos.CallingConfigurationDto;
import com.ordexa.calling.dto.CallingDtos.CallingOverviewDto;
import com.ordexa.calling.dto.CallingDtos.ManualCallActionRequest;
import com.ordexa.calling.dto.CallingDtos.OrderLineBriefDto;
import com.ordexa.calling.dto.CallingDtos.ProviderWebhookPayload;
import com.ordexa.calling.dto.CallingDtos.SimulateCallOutcomeRequest;
import com.ordexa.calling.dto.CallingDtos.SyncEligibleOrdersResponse;
import com.ordexa.calling.dto.CallingDtos.TranscriptTurnPayload;
import com.ordexa.calling.dto.CallingDtos.UpdateCallingConfigurationRequest;
import com.ordexa.calling.entity.CallAttempt;
import com.ordexa.calling.entity.CallAttemptStatus;
import com.ordexa.calling.entity.CallEvent;
import com.ordexa.calling.entity.CallOutcome;
import com.ordexa.calling.entity.CallSession;
import com.ordexa.calling.entity.CallSessionStatus;
import com.ordexa.calling.entity.CallTranscript;
import com.ordexa.calling.entity.CallingConfiguration;
import com.ordexa.calling.entity.CustomerCallingPreference;
import com.ordexa.calling.entity.TranscriptSpeakerRole;
import com.ordexa.calling.events.OrderCreatedForCallingEvent;
import com.ordexa.calling.integration.HttpVoiceServiceCallingProvider;
import com.ordexa.calling.integration.SandboxVoiceCallingProvider;
import com.ordexa.calling.integration.VoiceCallingProvider;
import com.ordexa.calling.integration.VoiceDispatchCommand;
import com.ordexa.calling.integration.VoiceDispatchResult;
import com.ordexa.calling.repository.CallAttemptRepository;
import com.ordexa.calling.repository.CallEventRepository;
import com.ordexa.calling.repository.CallSessionRepository;
import com.ordexa.calling.repository.CallTranscriptRepository;
import com.ordexa.calling.repository.CallingConfigurationRepository;
import com.ordexa.calling.repository.CustomerCallingPreferenceRepository;
import com.ordexa.common.exception.ErrorCode;
import com.ordexa.common.exception.OrdexaException;
import com.ordexa.common.exception.ResourceNotFoundException;
import com.ordexa.common.response.PagedResponse;
import com.ordexa.common.validation.PaginationValidator;
import com.ordexa.customer.entity.Customer;
import com.ordexa.customer.intelligence.entity.CustomerBehaviouralEvent;
import com.ordexa.customer.intelligence.entity.CustomerBehaviouralEventType;
import com.ordexa.customer.intelligence.repository.CustomerBehaviouralEventRepository;
import com.ordexa.customer.repository.CustomerRepository;
import com.ordexa.merchant.entity.Merchant;
import com.ordexa.merchant.repository.MerchantRepository;
import com.ordexa.order.entity.Order;
import com.ordexa.order.entity.OrderItem;
import com.ordexa.order.entity.OrderStatus;
import com.ordexa.order.entity.OrderStatusHistory;
import com.ordexa.order.entity.PaymentMethod;
import com.ordexa.order.repository.OrderItemRepository;
import com.ordexa.order.repository.OrderRepository;
import com.ordexa.order.repository.OrderStatusHistoryRepository;
import com.ordexa.risk.RtoRiskAssessmentDto;
import com.ordexa.risk.RtoRiskScoringService;
import com.ordexa.tenant.context.TenantContext;
import com.ordexa.tenant.context.TenantContextHolder;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Core orchestration service for the NORTHSTAR AI Calling Agent.
 *
 * Enforces the foundational business rule: EVERY eligible Cash-on-Delivery (COD)
 * order enters the AI calling workflow regardless of its RTO risk score.
 */
@Service
public class CallingWorkflowService {

    private static final Logger log = LoggerFactory.getLogger(CallingWorkflowService.class);
    private static final Set<String> ALLOWED_SORT_FIELDS =
            Set.of("createdAt", "nextAttemptAt", "lastAttemptAt", "rtoRiskScoreSnapshot", "attemptCount");

    private final CallingProperties callingProperties;
    private final CallingConfigurationRepository configRepository;
    private final CustomerCallingPreferenceRepository preferenceRepository;
    private final CallSessionRepository sessionRepository;
    private final CallAttemptRepository attemptRepository;
    private final CallTranscriptRepository transcriptRepository;
    private final CallEventRepository eventRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final OrderStatusHistoryRepository statusHistoryRepository;
    private final CustomerRepository customerRepository;
    private final MerchantRepository merchantRepository;
    private final CustomerBehaviouralEventRepository behaviouralEventRepository;
    private final AuditLogRepository auditLogRepository;
    private final RtoRiskScoringService rtoRiskScoringService;
    private final Map<String, VoiceCallingProvider> providersByCode;
    private final Clock clock;

    public CallingWorkflowService(
            CallingProperties callingProperties,
            CallingConfigurationRepository configRepository,
            CustomerCallingPreferenceRepository preferenceRepository,
            CallSessionRepository sessionRepository,
            CallAttemptRepository attemptRepository,
            CallTranscriptRepository transcriptRepository,
            CallEventRepository eventRepository,
            OrderRepository orderRepository,
            OrderItemRepository orderItemRepository,
            OrderStatusHistoryRepository statusHistoryRepository,
            CustomerRepository customerRepository,
            MerchantRepository merchantRepository,
            CustomerBehaviouralEventRepository behaviouralEventRepository,
            AuditLogRepository auditLogRepository,
            RtoRiskScoringService rtoRiskScoringService,
            List<VoiceCallingProvider> providers,
            Clock clock) {
        this.callingProperties = callingProperties;
        this.configRepository = configRepository;
        this.preferenceRepository = preferenceRepository;
        this.sessionRepository = sessionRepository;
        this.attemptRepository = attemptRepository;
        this.transcriptRepository = transcriptRepository;
        this.eventRepository = eventRepository;
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.statusHistoryRepository = statusHistoryRepository;
        this.customerRepository = customerRepository;
        this.merchantRepository = merchantRepository;
        this.behaviouralEventRepository = behaviouralEventRepository;
        this.auditLogRepository = auditLogRepository;
        this.rtoRiskScoringService = rtoRiskScoringService;
        this.providersByCode = providers.stream()
                .collect(Collectors.toMap(
                        p -> p.providerCode().toUpperCase(Locale.ROOT),
                        Function.identity()));
        this.clock = clock;
    }

    @EventListener
    @Transactional
    public void onOrderCreated(OrderCreatedForCallingEvent event) {
        if (!Boolean.TRUE.equals(callingProperties.enabled())) {
            return;
        }
        orderRepository.findByIdAndMerchantIdWithCustomer(event.orderId(), event.merchantId())
                .ifPresent(order -> enrollCodOrderIfEligible(order, true));
    }

    /**
     * Enrolls a COD order into the AI verification queue regardless of RTO risk score.
     * Idempotent per (merchantId, orderId).
     */
    @Transactional
    public Optional<CallSession> enrollCodOrderIfEligible(Order order, boolean autoDispatchIfPermittedWindow) {
        if (order.getPaymentMethod() != PaymentMethod.COD) {
            return Optional.empty();
        }
        if (order.getOrderStatus() != OrderStatus.CREATED) {
            return Optional.empty();
        }

        UUID merchantId = order.getMerchantId();
        Optional<CallSession> existing = sessionRepository.findByMerchantIdAndOrder_Id(merchantId, order.getId());
        if (existing.isPresent()) {
            return existing;
        }

        CallingConfiguration cfg = getOrCreateConfigEntity(merchantId);
        Customer customer = order.getCustomer();
        OffsetDateTime now = OffsetDateTime.now(clock);

        // Compute initial 4-pillar RTO risk strictly as an informational snapshot.
        // NEVER use RTO risk score to suppress or skip initial COD verification calls!
        RtoRiskAssessmentDto initialRisk = rtoRiskScoringService.assessOrder(order, customer, null);

        CustomerCallingPreference pref = preferenceRepository
                .findByMerchantIdAndCustomerId(merchantId, customer.getId())
                .orElse(null);

        String resolvedLang = (pref != null && pref.getPreferredLanguage() != null && !pref.getPreferredLanguage().isBlank())
                ? pref.getPreferredLanguage()
                : cfg.getDefaultLanguage();

        String idempotencyKey = "cod-verify:" + merchantId + ":" + order.getId();
        String rawPhone = customer.getPhoneNumber();
        String normalizedPhone = CallingDndPolicy.normalizeToE164(rawPhone);
        String phone = normalizedPhone != null ? normalizedPhone : (rawPhone != null ? rawPhone : "UNKNOWN");

        if (!cfg.isEnabled()) {
            CallSession paused = new CallSession(
                    UUID.randomUUID(),
                    merchantId,
                    order,
                    customer,
                    idempotencyKey,
                    phone,
                    resolvedLang,
                    CallSessionStatus.STOPPED,
                    cfg.getMaxAttempts(),
                    initialRisk.totalRiskScore(),
                    initialRisk.riskBand(),
                    null);
            paused.setDoNotCallFurther(true);
            paused.setRecommendedAction("Merchant automated calling was disabled at order creation.");
            CallSession saved = sessionRepository.save(paused);
            recordEvent(saved, null, null, "ENROLLED_PAUSED", "SYSTEM",
                    "Order enrolled while merchant calling configuration was disabled", now);
            return Optional.of(saved);
        }

        if (pref != null && pref.isOptedOut()) {
            CallSession optedOutSession = new CallSession(
                    UUID.randomUUID(),
                    merchantId,
                    order,
                    customer,
                    idempotencyKey,
                    phone,
                    resolvedLang,
                    CallSessionStatus.STOPPED,
                    cfg.getMaxAttempts(),
                    initialRisk.totalRiskScore(),
                    initialRisk.riskBand(),
                    null);
            optedOutSession.setDoNotCallFurther(true);
            optedOutSession.setRecommendedAction("Customer opted out of automated voice calls (DNC honored).");
            CallSession saved = sessionRepository.save(optedOutSession);
            recordEvent(saved, null, null, "SKIPPED_DNC_OPT_OUT", "SYSTEM",
                    "Suppressed automated call because customer opted out (" + pref.getOptedOutReason() + ")", now);
            return Optional.of(saved);
        }

        if (normalizedPhone == null) {
            CallSession invalidSession = new CallSession(
                    UUID.randomUUID(),
                    merchantId,
                    order,
                    customer,
                    idempotencyKey,
                    phone != null ? phone : "UNKNOWN",
                    resolvedLang,
                    CallSessionStatus.COMPLETED,
                    cfg.getMaxAttempts(),
                    initialRisk.totalRiskScore(),
                    initialRisk.riskBand(),
                    null);
            invalidSession.setFinalOutcome(CallOutcome.INVALID_NUMBER);
            invalidSession.setDoNotCallFurther(true);
            invalidSession.setCompletedAt(now);
            invalidSession.setAiSummary("Automated call skipped: customer phone number failed E.164 / Indian mobile validation.");
            invalidSession.setCustomerIntent("Unreachable (Invalid Number)");

            RtoRiskAssessmentDto updatedRisk = rtoRiskScoringService.assessOrder(order, customer, invalidSession);
            invalidSession.setUpdatedRtoRiskScore(updatedRisk.totalRiskScore());
            invalidSession.setUpdatedRtoRiskBand(updatedRisk.riskBand());
            invalidSession.setRecommendedAction(updatedRisk.recommendedAction());

            CallSession saved = sessionRepository.save(invalidSession);
            recordEvent(saved, null, null, "INVALID_NUMBER_DETECTED", "SYSTEM",
                    "Phone number failed carrier validation prior to dialing", now);
            return Optional.of(saved);
        }

        OffsetDateTime scheduledTime = CallingDndPolicy.adjustForDnd(
                now,
                cfg.getDndStartHourIst(),
                cfg.getDndEndHourIst(),
                cfg.getDndResumeMinuteIst());

        CallSession queued = new CallSession(
                UUID.randomUUID(),
                merchantId,
                order,
                customer,
                idempotencyKey,
                phone,
                resolvedLang,
                CallSessionStatus.QUEUED,
                cfg.getMaxAttempts(),
                initialRisk.totalRiskScore(),
                initialRisk.riskBand(),
                scheduledTime);
        queued.setRecommendedAction(initialRisk.recommendedAction());

        CallSession saved = sessionRepository.save(queued);
        boolean deferredForDnd = scheduledTime.isAfter(now.plusSeconds(5));
        recordEvent(
                saved,
                null,
                null,
                "COD_CALL_QUEUED",
                "SYSTEM",
                "Enrolled COD order " + order.getOrderNumber()
                        + " (initial RTO risk: " + initialRisk.totalRiskScore() + "/" + initialRisk.riskBand()
                        + " — risk never suppresses COD verification)"
                        + (deferredForDnd ? "; deferred to " + scheduledTime + " per TRAI DND window" : ""),
                now);

        if (autoDispatchIfPermittedWindow && !deferredForDnd) {
            dispatchSessionInternal(saved, cfg, false, "AUTO_SCHEDULER");
        }

        return Optional.of(saved);
    }

    @Transactional
    public SyncEligibleOrdersResponse syncEligibleCodOrdersForActiveMerchant(boolean dispatchImmediate) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        UUID merchantId = ctx.merchantId();
        List<Order> orders = orderRepository.findAllByMerchantIdWithCustomerOrderByCreatedAtDesc(merchantId);

        int newlyEnrolled = 0;
        int alreadyEnrolled = 0;
        int dispatched = 0;

        for (Order order : orders) {
            if (order.getPaymentMethod() != PaymentMethod.COD || order.getOrderStatus() != OrderStatus.CREATED) {
                continue;
            }
            if (sessionRepository.findByMerchantIdAndOrder_Id(merchantId, order.getId()).isPresent()) {
                alreadyEnrolled++;
                continue;
            }
            Optional<CallSession> created = enrollCodOrderIfEligible(order, dispatchImmediate);
            if (created.isPresent()) {
                newlyEnrolled++;
                if (created.get().getAttemptCount() > 0) {
                    dispatched++;
                }
            }
        }
        return new SyncEligibleOrdersResponse(newlyEnrolled, alreadyEnrolled, dispatched);
    }

    /**
     * Dispatches a single queued/retry-scheduled session via the configured VoiceCallingProvider.
     */
    @Transactional
    public CallSessionDetailDto manualRetryOrDispatch(
            UUID sessionId,
            ManualCallActionRequest request,
            String clientIp) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        CallSession session = sessionRepository.findByIdAndMerchantIdWithDetails(sessionId, ctx.merchantId())
                .orElseThrow(() -> new ResourceNotFoundException("Call session not found in active merchant workspace"));

        if (session.isDoNotCallFurther() && session.getFinalOutcome() == CallOutcome.CANCELLATION_REQUESTED) {
            throw new OrdexaException(
                    "Cannot place further calls: customer already requested order cancellation",
                    ErrorCode.CALL_ACTION_NOT_ALLOWED,
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }

        CustomerCallingPreference pref = preferenceRepository
                .findByMerchantIdAndCustomerId(ctx.merchantId(), session.getCustomer().getId())
                .orElse(null);
        if (pref != null && pref.isOptedOut()) {
            throw new OrdexaException(
                    "Cannot dial customer: customer has opted out of automated calls (DNC active)",
                    ErrorCode.CALL_ACTION_NOT_ALLOWED,
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }

        if (session.getFinalOutcome() == CallOutcome.CONFIRMED) {
            throw new OrdexaException(
                    "Order has already been confirmed by the customer",
                    ErrorCode.CALL_ACTION_NOT_ALLOWED,
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }

        if (session.getStatus() == CallSessionStatus.IN_PROGRESS
                || session.getStatus() == CallSessionStatus.DISPATCHING) {
            throw new OrdexaException(
                    "A call attempt is already active for this order; reconcile or wait before retrying",
                    ErrorCode.CALL_ACTION_NOT_ALLOWED,
                    HttpStatus.CONFLICT);
        }

        if (request != null && request.preferredLanguage() != null && !request.preferredLanguage().isBlank()) {
            session.setLanguage(request.preferredLanguage().trim());
        }

        CallingConfiguration cfg = getOrCreateConfigEntity(ctx.merchantId());
        if (session.getAttemptCount() >= session.getMaxAttempts()) {
            session.setMaxAttempts(session.getAttemptCount() + 1);
        }
        session.setDoNotCallFurther(false);
        session.setStatus(CallSessionStatus.QUEUED);

        String actor = ctx.fullName() != null ? ctx.fullName() : "Merchant Operator";
        boolean bypassDndForSandbox = SandboxVoiceCallingProvider.CODE.equalsIgnoreCase(resolveProviderCode(cfg));
        dispatchSessionInternal(session, cfg, bypassDndForSandbox, actor);

        auditLogRepository.save(new AuditLog(
                ctx.merchantId(),
                ctx.userId(),
                "CALL_MANUAL_RETRY",
                "CALL_SESSION",
                session.getId().toString(),
                "Manual call dispatch/retry triggered for order " + session.getOrder().getOrderNumber(),
                clientIp));

        return getSessionDetail(session.getId());
    }

    @Transactional
    public CallSessionDetailDto stopFurtherCalls(
            UUID sessionId,
            ManualCallActionRequest request,
            String clientIp) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        CallSession session = sessionRepository.findByIdAndMerchantIdWithDetails(sessionId, ctx.merchantId())
                .orElseThrow(() -> new ResourceNotFoundException("Call session not found in active merchant workspace"));

        OffsetDateTime now = OffsetDateTime.now(clock);
        String reason = (request != null && request.reason() != null && !request.reason().isBlank())
                ? request.reason().trim()
                : "Stopped manually by merchant operator";

        session.setDoNotCallFurther(true);
        session.setNextAttemptAt(null);
        if (!session.getStatus().isTerminal()) {
            session.setStatus(CallSessionStatus.STOPPED);
            session.setCompletedAt(now);
        }
        session.setRecommendedAction("Automated calling stopped (" + reason + "). Review manually before dispatch.");
        sessionRepository.save(session);

        if (request != null && Boolean.TRUE.equals(request.optOutCustomer())) {
            CustomerCallingPreference pref = preferenceRepository
                    .findByMerchantIdAndCustomerId(ctx.merchantId(), session.getCustomer().getId())
                    .orElseGet(() -> new CustomerCallingPreference(ctx.merchantId(), session.getCustomer().getId()));
            pref.markOptedOut(reason, now);
            preferenceRepository.save(pref);
        }

        recordEvent(session, null, null, "CALLS_STOPPED", ctx.fullName(), reason, now);
        auditLogRepository.save(new AuditLog(
                ctx.merchantId(),
                ctx.userId(),
                "CALL_STOPPED",
                "CALL_SESSION",
                session.getId().toString(),
                "Stopped future calls for order " + session.getOrder().getOrderNumber() + ": " + reason,
                clientIp));

        return getSessionDetail(session.getId());
    }

    @Transactional
    public CallSessionDetailDto escalateToHuman(
            UUID sessionId,
            ManualCallActionRequest request,
            String clientIp) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        CallSession session = sessionRepository.findByIdAndMerchantIdWithDetails(sessionId, ctx.merchantId())
                .orElseThrow(() -> new ResourceNotFoundException("Call session not found in active merchant workspace"));

        OffsetDateTime now = OffsetDateTime.now(clock);
        String reason = (request != null && request.reason() != null && !request.reason().isBlank())
                ? request.reason().trim()
                : "Escalated to human operations specialist";

        session.setStatus(CallSessionStatus.ESCALATED);
        session.setFinalOutcome(CallOutcome.HUMAN_ESCALATION);
        session.setDoNotCallFurther(true);
        session.setNextAttemptAt(null);
        session.setCompletedAt(now);

        RtoRiskAssessmentDto updatedRisk = rtoRiskScoringService.assessOrder(
                session.getOrder(), session.getCustomer(), session);
        session.setUpdatedRtoRiskScore(updatedRisk.totalRiskScore());
        session.setUpdatedRtoRiskBand(updatedRisk.riskBand());
        session.setRecommendedAction(updatedRisk.recommendedAction());
        sessionRepository.save(session);

        behaviouralEventRepository.save(new CustomerBehaviouralEvent(
                UUID.randomUUID(),
                ctx.merchantId(),
                session.getCustomer().getId(),
                session.getOrder().getId(),
                CustomerBehaviouralEventType.CALL_HUMAN_ESCALATION,
                "COD call escalated to human agent (" + session.getOrder().getOrderNumber() + ")",
                reason,
                now));

        recordEvent(session, null, null, "ESCALATED_TO_HUMAN", ctx.fullName(), reason, now);
        auditLogRepository.save(new AuditLog(
                ctx.merchantId(),
                ctx.userId(),
                "CALL_ESCALATED",
                "CALL_SESSION",
                session.getId().toString(),
                "Escalated COD verification to human agent for order " + session.getOrder().getOrderNumber(),
                clientIp));

        return getSessionDetail(session.getId());
    }

    /**
     * Simulates a complete conversational outcome in SANDBOX / test environments,
     * exercising the exact same outcome-processing pipeline as signed webhooks.
     */
    @Transactional
    public CallSessionDetailDto simulateOutcomeForMerchant(
            UUID sessionId,
            SimulateCallOutcomeRequest request,
            String clientIp) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        CallSession session = sessionRepository.findByIdAndMerchantIdWithDetails(sessionId, ctx.merchantId())
                .orElseThrow(() -> new ResourceNotFoundException("Call session not found in active merchant workspace"));

        CallingConfiguration cfg = getOrCreateConfigEntity(ctx.merchantId());
        if (session.getAttemptCount() == 0
                || (session.getStatus() == CallSessionStatus.QUEUED
                        || session.getStatus() == CallSessionStatus.RETRY_SCHEDULED)) {
            dispatchSessionInternal(session, cfg, true, ctx.fullName());
        }

        CallAttempt latestAttempt = attemptRepository
                .findFirstByCallSession_IdOrderByAttemptNumberDesc(session.getId())
                .orElseThrow(() -> new OrdexaException(
                        "No call attempt available to apply simulated outcome",
                        ErrorCode.CALL_ACTION_NOT_ALLOWED,
                        HttpStatus.UNPROCESSABLE_ENTITY));

        String lang = (request.language() != null && !request.language().isBlank())
                ? request.language().trim()
                : session.getLanguage();
        Order order = session.getOrder();
        Customer customer = session.getCustomer();
        OffsetDateTime now = OffsetDateTime.now(clock);

        List<TranscriptTurnPayload> turns = buildSimulatedTranscript(
                order, customer, lang, request.outcome(), request.customerUtterance(), now);
        String summary = (request.summaryOverride() != null && !request.summaryOverride().isBlank())
                ? request.summaryOverride().trim()
                : defaultSummaryForOutcome(order, request.outcome());
        String intent = defaultIntentForOutcome(request.outcome());
        int duration = request.durationSeconds() != null
                ? request.durationSeconds()
                : defaultDurationForOutcome(request.outcome());

        ProviderWebhookPayload syntheticWebhook = new ProviderWebhookPayload(
                "sim-" + UUID.randomUUID(),
                "CALL_COMPLETED",
                session.getId(),
                latestAttempt.getId(),
                latestAttempt.getProviderCallId(),
                latestAttempt.getRoomName(),
                request.outcome(),
                duration,
                null,
                summary,
                intent,
                request.customerOptOut(),
                request.outcome() == CallOutcome.CALL_FAILED ? "Simulated SIP carrier failure" : null,
                turns);

        applyWebhookOutcomeInternal(session, latestAttempt, syntheticWebhook, "SANDBOX_SIMULATOR (" + ctx.fullName() + ")");

        auditLogRepository.save(new AuditLog(
                ctx.merchantId(),
                ctx.userId(),
                "CALL_OUTCOME_SIMULATED",
                "CALL_SESSION",
                session.getId().toString(),
                "Simulated call outcome " + request.outcome() + " for order " + order.getOrderNumber(),
                clientIp));

        return getSessionDetail(session.getId());
    }

    /**
     * Processes authenticated webhooks from the Voice Service / telephony provider.
     * Enforces strict webhook_event_id deduplication and merchant/session validation.
     */
    @Transactional
    public boolean processProviderWebhook(ProviderWebhookPayload payload) {
        if (eventRepository.existsByWebhookEventId(payload.eventId())) {
            log.info("[calling-webhook] Idempotent replay ignored for eventId={}", payload.eventId());
            return false;
        }

        CallAttempt attempt = null;
        if (payload.callAttemptId() != null) {
            attempt = attemptRepository.findById(payload.callAttemptId()).orElse(null);
        }
        if (attempt == null && payload.providerCallId() != null && !payload.providerCallId().isBlank()) {
            attempt = attemptRepository.findByProviderCallId(payload.providerCallId()).orElse(null);
        }

        UUID resolvedSessionId = payload.callSessionId() != null
                ? payload.callSessionId()
                : (attempt != null ? attempt.getCallSession().getId() : null);
        if (resolvedSessionId == null) {
            throw new ResourceNotFoundException("Unable to resolve call session for webhook event " + payload.eventId());
        }

        CallSession session = sessionRepository.findByIdWithDetails(resolvedSessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Call session not found: " + resolvedSessionId));

        if (attempt != null && !attempt.getCallSession().getId().equals(session.getId())) {
            throw new OrdexaException(
                    "Call attempt does not belong to target call session",
                    ErrorCode.VALIDATION_ERROR,
                    HttpStatus.BAD_REQUEST);
        }

        if (attempt == null) {
            attempt = attemptRepository.findFirstByCallSession_IdOrderByAttemptNumberDesc(session.getId())
                    .orElse(null);
        }

        applyWebhookOutcomeInternal(session, attempt, payload, "VOICE_WEBHOOK");
        return true;
    }

    @Transactional
    public int dispatchDueQueuedSessions(int limit) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        List<CallSession> due = sessionRepository.findDueSessions(
                List.of(CallSessionStatus.QUEUED, CallSessionStatus.RETRY_SCHEDULED),
                now,
                PageRequest.of(0, limit));

        int count = 0;
        for (CallSession session : due) {
            CallingConfiguration cfg = getOrCreateConfigEntity(session.getMerchantId());
            if (!cfg.isEnabled()) {
                continue;
            }
            if (CallingDndPolicy.isInDndWindow(
                    now, cfg.getDndStartHourIst(), cfg.getDndEndHourIst(), cfg.getDndResumeMinuteIst())) {
                session.setNextAttemptAt(CallingDndPolicy.adjustForDnd(
                        now, cfg.getDndStartHourIst(), cfg.getDndEndHourIst(), cfg.getDndResumeMinuteIst()));
                sessionRepository.save(session);
                continue;
            }
            if (dispatchSessionInternal(session, cfg, false, "QUEUE_SCHEDULER")) {
                count++;
            }
        }
        return count;
    }

    @Transactional
    public int sweepTimedOutActiveSessions(int limit) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        // Sweep sessions stuck in DISPATCHING/IN_PROGRESS for > 5 minutes without webhook resolution
        OffsetDateTime cutoff = now.minusMinutes(5);
        List<CallSession> stuck = sessionRepository.findTimedOutActiveSessions(
                List.of(CallSessionStatus.DISPATCHING, CallSessionStatus.IN_PROGRESS),
                cutoff,
                PageRequest.of(0, limit));

        int swept = 0;
        for (CallSession session : stuck) {
            CallAttempt latestAttempt = attemptRepository
                    .findFirstByCallSession_IdOrderByAttemptNumberDesc(session.getId())
                    .orElse(null);
            ProviderWebhookPayload timeoutPayload = new ProviderWebhookPayload(
                    "timeout-sweep-" + session.getId() + "-att" + session.getAttemptCount(),
                    "CALL_TIMEOUT_SWEEP",
                    session.getId(),
                    latestAttempt != null ? latestAttempt.getId() : null,
                    latestAttempt != null ? latestAttempt.getProviderCallId() : null,
                    latestAttempt != null ? latestAttempt.getRoomName() : null,
                    CallOutcome.NO_ANSWER,
                    0,
                    null,
                    "Call attempt timed out without customer pickup or webhook completion.",
                    "Unanswered (Timeout)",
                    false,
                    "Call ring/session timeout exceeded",
                    Collections.emptyList());
            if (!eventRepository.existsByWebhookEventId(timeoutPayload.eventId())) {
                applyWebhookOutcomeInternal(session, latestAttempt, timeoutPayload, "TIMEOUT_SWEEPER");
                swept++;
            }
        }
        return swept;
    }

    @Transactional(readOnly = true)
    public CallingOverviewDto getOverview() {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        UUID merchantId = ctx.merchantId();
        CallingConfiguration cfg = configRepository.findByMerchantId(merchantId)
                .orElseGet(() -> new CallingConfiguration(merchantId, callingProperties.provider()));

        List<CallSession> sessions = sessionRepository.findByMerchantIdOrderByCreatedAtDesc(merchantId);
        long totalCodOrders = orderRepository.findAllByMerchantIdWithCustomerOrderByCreatedAtDesc(merchantId).stream()
                .filter(o -> o.getPaymentMethod() == PaymentMethod.COD)
                .count();

        long queuedOrScheduled = sessions.stream()
                .filter(s -> s.getStatus() == CallSessionStatus.QUEUED
                        || s.getStatus() == CallSessionStatus.RETRY_SCHEDULED)
                .count();
        long callsInitiated = attemptRepository.countByMerchantId(merchantId);
        long callsCompleted = sessions.stream()
                .filter(s -> s.getStatus() == CallSessionStatus.COMPLETED
                        || s.getStatus() == CallSessionStatus.ESCALATED)
                .count();
        long confirmed = sessions.stream().filter(s -> s.getFinalOutcome() == CallOutcome.CONFIRMED).count();
        long rejected = sessions.stream().filter(s -> s.getFinalOutcome() == CallOutcome.REJECTED).count();
        long unanswered = sessions.stream()
                .filter(s -> s.getFinalOutcome() == CallOutcome.NO_ANSWER
                        || s.getFinalOutcome() == CallOutcome.BUSY)
                .count();
        long cancellationReqs = sessions.stream()
                .filter(s -> s.getFinalOutcome() == CallOutcome.CANCELLATION_REQUESTED)
                .count();
        long escalated = sessions.stream()
                .filter(s -> s.getStatus() == CallSessionStatus.ESCALATED
                        || s.getFinalOutcome() == CallOutcome.HUMAN_ESCALATION)
                .count();
        long failed = sessions.stream()
                .filter(s -> s.getStatus() == CallSessionStatus.FAILED
                        || s.getFinalOutcome() == CallOutcome.CALL_FAILED
                        || s.getFinalOutcome() == CallOutcome.INVALID_NUMBER)
                .count();

        boolean inDnd = CallingDndPolicy.isInDndWindow(
                OffsetDateTime.now(clock),
                cfg.getDndStartHourIst(),
                cfg.getDndEndHourIst(),
                cfg.getDndResumeMinuteIst());

        return new CallingOverviewDto(
                Math.max(totalCodOrders, sessions.size()),
                queuedOrScheduled,
                callsInitiated,
                callsCompleted,
                confirmed,
                rejected,
                unanswered,
                cancellationReqs,
                escalated,
                failed,
                inDnd,
                resolveProviderCode(cfg));
    }

    @Transactional(readOnly = true)
    public PagedResponse<CallQueueItemDto> listQueue(
            String search,
            CallSessionStatus status,
            CallOutcome outcome,
            String riskBand,
            OffsetDateTime fromDate,
            OffsetDateTime toDate,
            int page,
            int size,
            String sortBy,
            String sortDir) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        PaginationValidator.validate(page, size);

        String resolvedSort = (sortBy != null && ALLOWED_SORT_FIELDS.contains(sortBy))
                ? sortBy
                : "createdAt";
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDir) ? Sort.Direction.ASC : Sort.Direction.DESC;

        Specification<CallSession> spec = (root, query, cb) -> {
            if (query != null && query.getResultType() != Long.class && query.getResultType() != long.class) {
                root.fetch("order");
                root.fetch("customer");
            }
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("merchantId"), ctx.merchantId()));

            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (outcome != null) {
                predicates.add(cb.equal(root.get("finalOutcome"), outcome));
            }
            if (riskBand != null && !riskBand.isBlank()) {
                String upperBand = riskBand.trim().toUpperCase(Locale.ROOT);
                Predicate byUpdated = cb.equal(root.get("updatedRtoRiskBand"), upperBand);
                Predicate byInitialWhenNull = cb.and(
                        cb.isNull(root.get("updatedRtoRiskBand")),
                        cb.equal(root.get("rtoRiskBandSnapshot"), upperBand));
                predicates.add(cb.or(byUpdated, byInitialWhenNull));
            }
            if (fromDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), fromDate));
            }
            if (toDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), toDate));
            }
            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
                Join<CallSession, Order> orderJoin = root.join("order");
                Join<CallSession, Customer> customerJoin = root.join("customer");
                predicates.add(cb.or(
                        cb.like(cb.lower(orderJoin.get("orderNumber")), pattern),
                        cb.like(cb.lower(customerJoin.get("fullName")), pattern),
                        cb.like(cb.lower(root.get("phoneNumber")), pattern)));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<CallSession> sessionPage = sessionRepository.findAll(
                spec, PageRequest.of(page, size, Sort.by(direction, resolvedSort)));

        List<CallSession> content = sessionPage.getContent();
        List<UUID> orderIds = content.stream().map(s -> s.getOrder().getId()).toList();
        Map<UUID, List<OrderItem>> itemsByOrder = orderIds.isEmpty()
                ? Collections.emptyMap()
                : orderItemRepository.findByOrderIdInAndMerchantId(orderIds, ctx.merchantId())
                        .stream()
                        .collect(Collectors.groupingBy(i -> i.getOrder().getId()));

        List<CallQueueItemDto> dtos = content.stream()
                .map(s -> toQueueItemDto(s, itemsByOrder.getOrDefault(s.getOrder().getId(), Collections.emptyList())))
                .toList();

        return new PagedResponse<>(
                dtos,
                sessionPage.getNumber(),
                sessionPage.getSize(),
                sessionPage.getTotalElements(),
                sessionPage.getTotalPages(),
                sessionPage.hasNext());
    }

    @Transactional(readOnly = true)
    public CallSessionDetailDto getSessionDetail(UUID sessionId) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        CallSession session = sessionRepository.findByIdAndMerchantIdWithDetails(sessionId, ctx.merchantId())
                .orElseThrow(() -> new ResourceNotFoundException("Call session not found in active merchant workspace"));

        Order order = session.getOrder();
        Customer customer = session.getCustomer();
        List<OrderItem> items = orderItemRepository.findByOrderIdAndMerchantId(order.getId(), ctx.merchantId());
        List<CallAttempt> attempts = attemptRepository
                .findByCallSession_IdAndMerchantIdOrderByAttemptNumberAsc(session.getId(), ctx.merchantId());
        List<CallTranscript> transcripts = transcriptRepository
                .findByCallSessionIdAndMerchantIdOrderByOccurredAtAscTurnIndexAsc(session.getId(), ctx.merchantId());
        List<CallEvent> events = eventRepository
                .findByCallSessionIdAndMerchantIdOrderByCreatedAtAsc(session.getId(), ctx.merchantId());

        boolean customerOptedOut = preferenceRepository
                .findByMerchantIdAndCustomerId(ctx.merchantId(), customer.getId())
                .map(CustomerCallingPreference::isOptedOut)
                .orElse(false);

        RtoRiskAssessmentDto rtoAssessment = rtoRiskScoringService.assessOrder(order, customer, session);

        return new CallSessionDetailDto(
                toQueueItemDto(session, items),
                order.getShippingAddress(),
                items.stream()
                        .map(i -> new OrderLineBriefDto(
                                i.getProductName(),
                                i.getSku(),
                                i.getQuantity(),
                                i.getUnitPrice(),
                                i.getTotalPrice()))
                        .toList(),
                session.getAiSummary(),
                session.getCustomerIntent(),
                session.getLastError(),
                customerOptedOut,
                rtoAssessment,
                attempts.stream().map(this::toAttemptDto).toList(),
                transcripts.stream().map(this::toTranscriptDto).toList(),
                events.stream().map(this::toEventDto).toList());
    }

    @Transactional(readOnly = true)
    public RtoRiskAssessmentDto getOrderRtoAssessment(UUID orderId) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        Order order = orderRepository.findByIdAndMerchantIdWithCustomer(orderId, ctx.merchantId())
                .orElseThrow(() -> new ResourceNotFoundException("Order not found in active merchant workspace"));
        CallSession session = sessionRepository
                .findByMerchantIdAndOrder_Id(ctx.merchantId(), orderId)
                .orElse(null);
        return rtoRiskScoringService.assessOrder(order, order.getCustomer(), session);
    }

    @Transactional
    public CallingConfigurationDto getConfiguration() {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        return toConfigDto(getOrCreateConfigEntity(ctx.merchantId()));
    }

    @Transactional
    public CallingConfigurationDto updateConfiguration(
            UpdateCallingConfigurationRequest req,
            String clientIp) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        CallingConfiguration cfg = getOrCreateConfigEntity(ctx.merchantId());

        String normalizedProvider = req.provider().trim().toUpperCase(Locale.ROOT);
        if (!providersByCode.containsKey(normalizedProvider)) {
            throw new OrdexaException(
                    "Unsupported calling provider '" + normalizedProvider
                            + "'. Available: " + providersByCode.keySet(),
                    ErrorCode.VALIDATION_ERROR,
                    HttpStatus.BAD_REQUEST);
        }

        cfg.setEnabled(req.enabled());
        cfg.setProvider(normalizedProvider);
        cfg.setDefaultLanguage(req.defaultLanguage().trim());
        cfg.setSupportedLanguages(req.supportedLanguages().trim());
        cfg.setMaxAttempts(req.maxAttempts());
        cfg.setRetryBackoffMinutes1(req.retryBackoffMinutes1());
        cfg.setRetryBackoffMinutes2(req.retryBackoffMinutes2());
        cfg.setCallTimeoutSeconds(req.callTimeoutSeconds());
        cfg.setDndStartHourIst(req.dndStartHourIst());
        cfg.setDndEndHourIst(req.dndEndHourIst());
        cfg.setAutoConfirmOrderOnYes(req.autoConfirmOrderOnYes());
        cfg.setAutoCancelOrderOnRequest(req.autoCancelOrderOnRequest());

        CallingConfiguration saved = configRepository.save(cfg);
        auditLogRepository.save(new AuditLog(
                ctx.merchantId(),
                ctx.userId(),
                "CALLING_CONFIG_UPDATED",
                "CALLING_CONFIG",
                saved.getId().toString(),
                "Updated AI calling configuration (provider=" + normalizedProvider + ", enabled=" + req.enabled() + ")",
                clientIp));
        return toConfigDto(saved);
    }

    // ── Internal Helpers ─────────────────────────────────────────────────────

    private boolean dispatchSessionInternal(
            CallSession session,
            CallingConfiguration cfg,
            boolean bypassDnd,
            String actor) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        if (!bypassDnd && CallingDndPolicy.isInDndWindow(
                now, cfg.getDndStartHourIst(), cfg.getDndEndHourIst(), cfg.getDndResumeMinuteIst())) {
            OffsetDateTime deferred = CallingDndPolicy.adjustForDnd(
                    now, cfg.getDndStartHourIst(), cfg.getDndEndHourIst(), cfg.getDndResumeMinuteIst());
            session.setNextAttemptAt(deferred);
            sessionRepository.save(session);
            return false;
        }

        int nextAttemptNum = session.getAttemptCount() + 1;
        String attemptIdempKey = session.getIdempotencyKey() + ":attempt:" + nextAttemptNum;
        if (attemptRepository.findByIdempotencyKey(attemptIdempKey).isPresent()) {
            return false;
        }

        String providerCode = resolveProviderCode(cfg);
        VoiceCallingProvider provider = providersByCode.getOrDefault(
                providerCode, providersByCode.get(SandboxVoiceCallingProvider.CODE));

        Order order = session.getOrder();
        Customer customer = session.getCustomer();
        List<OrderItem> items = orderItemRepository.findByOrderIdAndMerchantId(order.getId(), session.getMerchantId());
        int totalUnits = items.stream().mapToInt(OrderItem::getQuantity).sum();
        String productSummary = items.isEmpty()
                ? "your order"
                : items.get(0).getProductName() + (items.size() > 1 ? " and " + (items.size() - 1) + " more item(s)" : "");
        String merchantName = merchantRepository.findById(session.getMerchantId())
                .map(Merchant::getBusinessName)
                .orElse("our store");

        UUID attemptId = UUID.randomUUID();
        session.setStatus(CallSessionStatus.DISPATCHING);
        session.setLastAttemptAt(now);
        sessionRepository.save(session);

        VoiceDispatchCommand command = new VoiceDispatchCommand(
                session.getMerchantId(),
                merchantName,
                session.getId(),
                attemptId,
                nextAttemptNum,
                attemptIdempKey,
                order.getId(),
                order.getOrderNumber(),
                customer.getId(),
                customer.getFullName(),
                session.getPhoneNumber(),
                session.getLanguage(),
                productSummary,
                Math.max(1, totalUnits),
                order.getTotalAmount(),
                order.getCurrency(),
                order.getShippingAddress(),
                "/api/v1/calling/webhooks/provider");

        VoiceDispatchResult result = provider.initiateCall(command);

        if (result.accepted()) {
            CallAttempt attempt = new CallAttempt(
                    attemptId,
                    session.getMerchantId(),
                    session,
                    nextAttemptNum,
                    attemptIdempKey,
                    provider.providerCode(),
                    result.providerCallId(),
                    result.roomName(),
                    CallAttemptStatus.IN_PROGRESS,
                    session.getLanguage(),
                    now);
            attemptRepository.save(attempt);

            session.setAttemptCount(nextAttemptNum);
            session.setStatus(CallSessionStatus.IN_PROGRESS);
            session.setNextAttemptAt(null);
            session.setLastError(null);
            sessionRepository.save(session);

            recordEvent(
                    session,
                    attempt.getId(),
                    null,
                    "CALL_INITIATED",
                    actor,
                    "Attempt #" + nextAttemptNum + " initiated via " + provider.providerCode()
                            + " (room=" + result.roomName() + ")",
                    now);
            return true;
        }

        if (result.ambiguousTimeout()) {
            // Provider HTTP request timed out AFTER sending: call may already be ringing!
            // Record open attempt and do NOT immediately retry to prevent duplicate calls.
            CallAttempt ambiguousAttempt = new CallAttempt(
                    attemptId,
                    session.getMerchantId(),
                    session,
                    nextAttemptNum,
                    attemptIdempKey,
                    provider.providerCode(),
                    null,
                    null,
                    CallAttemptStatus.INITIATED,
                    session.getLanguage(),
                    now);
            ambiguousAttempt.setFailureReason(result.errorMessage());
            attemptRepository.save(ambiguousAttempt);

            session.setAttemptCount(nextAttemptNum);
            session.setStatus(CallSessionStatus.IN_PROGRESS);
            session.setLastError(result.errorMessage());
            sessionRepository.save(session);

            recordEvent(
                    session,
                    ambiguousAttempt.getId(),
                    null,
                    "DISPATCH_AMBIGUOUS_TIMEOUT",
                    actor,
                    result.errorMessage(),
                    now);
            return false;
        }

        // Definite pre-placement dispatch rejection -> safe to apply retry backoff
        CallAttempt failedAttempt = new CallAttempt(
                attemptId,
                session.getMerchantId(),
                session,
                nextAttemptNum,
                attemptIdempKey,
                provider.providerCode(),
                null,
                null,
                CallAttemptStatus.FAILED,
                session.getLanguage(),
                now);
        failedAttempt.setOutcome(CallOutcome.CALL_FAILED);
        failedAttempt.setFailureReason(result.errorMessage());
        failedAttempt.setEndedAt(now);
        attemptRepository.save(failedAttempt);

        session.setAttemptCount(nextAttemptNum);
        session.setLastError(result.errorMessage());
        scheduleRetryOrFinalize(session, cfg, CallOutcome.CALL_FAILED, result.errorMessage(), now);
        sessionRepository.save(session);

        recordEvent(
                session,
                failedAttempt.getId(),
                null,
                "CALL_DISPATCH_FAILED",
                actor,
                "Attempt #" + nextAttemptNum + " failed before placement: " + result.errorMessage(),
                now);
        return false;
    }

    private void applyWebhookOutcomeInternal(
            CallSession session,
            CallAttempt attempt,
            ProviderWebhookPayload payload,
            String actor) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        UUID merchantId = session.getMerchantId();
        CallingConfiguration cfg = getOrCreateConfigEntity(merchantId);

        if (attempt != null && payload.transcriptTurns() != null) {
            for (TranscriptTurnPayload turn : payload.transcriptTurns()) {
                if (transcriptRepository.findByCallAttemptIdAndTurnIndex(attempt.getId(), turn.turnIndex()).isPresent()) {
                    continue;
                }
                TranscriptSpeakerRole role = parseSpeakerRole(turn.role());
                transcriptRepository.save(new CallTranscript(
                        UUID.randomUUID(),
                        merchantId,
                        session.getId(),
                        attempt.getId(),
                        turn.turnIndex(),
                        role,
                        turn.text() != null ? turn.text() : "",
                        turn.language() != null ? turn.language() : session.getLanguage(),
                        turn.confidence(),
                        turn.occurredAt() != null ? turn.occurredAt() : now));
            }
        }

        CallOutcome outcome = payload.outcome();
        if (outcome == null) {
            recordEvent(
                    session,
                    attempt != null ? attempt.getId() : null,
                    payload.eventId(),
                    payload.eventType(),
                    actor,
                    "Progress webhook processed (" + payload.eventType() + ")",
                    now);
            return;
        }

        if (attempt != null) {
            attempt.setOutcome(outcome);
            attempt.setStatus(mapAttemptStatus(outcome));
            if (payload.durationSeconds() != null) {
                attempt.setDurationSeconds(payload.durationSeconds());
            }
            if (payload.recordingUrl() != null && !payload.recordingUrl().isBlank()) {
                attempt.setRecordingUrl(payload.recordingUrl());
            }
            if (payload.failureReason() != null && !payload.failureReason().isBlank()) {
                attempt.setFailureReason(payload.failureReason());
            }
            if (attempt.getAnsweredAt() == null && outcome != CallOutcome.NO_ANSWER
                    && outcome != CallOutcome.BUSY && outcome != CallOutcome.CALL_FAILED
                    && outcome != CallOutcome.INVALID_NUMBER) {
                attempt.setAnsweredAt(attempt.getStartedAt().plusSeconds(4));
            }
            attempt.setEndedAt(now);
            attemptRepository.save(attempt);
        }

        if (payload.aiSummary() != null && !payload.aiSummary().isBlank()) {
            session.setAiSummary(payload.aiSummary().trim());
        }
        if (payload.customerIntent() != null && !payload.customerIntent().isBlank()) {
            session.setCustomerIntent(payload.customerIntent().trim());
        }

        if (Boolean.TRUE.equals(payload.customerOptOut())) {
            CustomerCallingPreference pref = preferenceRepository
                    .findByMerchantIdAndCustomerId(merchantId, session.getCustomer().getId())
                    .orElseGet(() -> new CustomerCallingPreference(merchantId, session.getCustomer().getId()));
            pref.markOptedOut("Customer requested opt-out during AI verification call", now);
            preferenceRepository.save(pref);
            session.setDoNotCallFurther(true);
        }

        Order order = session.getOrder();
        Customer customer = session.getCustomer();

        switch (outcome) {
            case CONFIRMED -> {
                session.setStatus(CallSessionStatus.COMPLETED);
                session.setFinalOutcome(CallOutcome.CONFIRMED);
                session.setCompletedAt(now);
                session.setNextAttemptAt(null);
                session.setLastError(null);

                if (cfg.isAutoConfirmOrderOnYes() && order.getOrderStatus() == OrderStatus.CREATED) {
                    OrderStatus prev = order.getOrderStatus();
                    order.setOrderStatus(OrderStatus.CONFIRMED);
                    orderRepository.save(order);
                    statusHistoryRepository.save(new OrderStatusHistory(
                            UUID.randomUUID(),
                            merchantId,
                            order,
                            prev,
                            OrderStatus.CONFIRMED,
                            "NORTHSTAR AI Calling Agent",
                            "Customer confirmed COD order details and delivery availability on voice call"));
                }

                behaviouralEventRepository.save(new CustomerBehaviouralEvent(
                        UUID.randomUUID(),
                        merchantId,
                        customer.getId(),
                        order.getId(),
                        CustomerBehaviouralEventType.CALL_VERIFICATION_CONFIRMED,
                        "COD order confirmed on AI call (" + order.getOrderNumber() + ")",
                        "Customer confirmed order items, address, and COD payment readiness.",
                        now));
            }
            case REJECTED -> {
                session.setStatus(CallSessionStatus.COMPLETED);
                session.setFinalOutcome(CallOutcome.REJECTED);
                session.setDoNotCallFurther(true);
                session.setCompletedAt(now);
                session.setNextAttemptAt(null);

                behaviouralEventRepository.save(new CustomerBehaviouralEvent(
                        UUID.randomUUID(),
                        merchantId,
                        customer.getId(),
                        order.getId(),
                        CustomerBehaviouralEventType.CALL_VERIFICATION_REJECTED,
                        "Buyer denied placing COD order (" + order.getOrderNumber() + ")",
                        "Customer explicitly denied placing this order during AI verification call.",
                        now));
            }
            case CANCELLATION_REQUESTED -> {
                session.setStatus(CallSessionStatus.COMPLETED);
                session.setFinalOutcome(CallOutcome.CANCELLATION_REQUESTED);
                session.setDoNotCallFurther(true);
                session.setCompletedAt(now);
                session.setNextAttemptAt(null);

                if (cfg.isAutoCancelOrderOnRequest() && order.getOrderStatus().canTransitionTo(OrderStatus.CANCELLED)) {
                    OrderStatus prev = order.getOrderStatus();
                    order.setOrderStatus(OrderStatus.CANCELLED);
                    customer.deductCancelledOrDeletedOrder(order.getTotalAmount());
                    customerRepository.save(customer);
                    orderRepository.save(order);
                    statusHistoryRepository.save(new OrderStatusHistory(
                            UUID.randomUUID(),
                            merchantId,
                            order,
                            prev,
                            OrderStatus.CANCELLED,
                            "NORTHSTAR AI Calling Agent",
                            "Order cancelled pre-dispatch per customer request on AI verification call"));
                }

                behaviouralEventRepository.save(new CustomerBehaviouralEvent(
                        UUID.randomUUID(),
                        merchantId,
                        customer.getId(),
                        order.getId(),
                        CustomerBehaviouralEventType.CALL_CANCELLATION_REQUESTED,
                        "Customer requested cancellation on AI call (" + order.getOrderNumber() + ")",
                        "Buyer asked to cancel the COD order; automated calls stopped immediately.",
                        now));
            }
            case HUMAN_ESCALATION -> {
                session.setStatus(CallSessionStatus.ESCALATED);
                session.setFinalOutcome(CallOutcome.HUMAN_ESCALATION);
                session.setDoNotCallFurther(true);
                session.setCompletedAt(now);
                session.setNextAttemptAt(null);

                behaviouralEventRepository.save(new CustomerBehaviouralEvent(
                        UUID.randomUUID(),
                        merchantId,
                        customer.getId(),
                        order.getId(),
                        CustomerBehaviouralEventType.CALL_HUMAN_ESCALATION,
                        "Customer requested human support agent (" + order.getOrderNumber() + ")",
                        "AI calling session escalated to merchant support queue.",
                        now));
            }
            case INVALID_NUMBER -> {
                session.setStatus(CallSessionStatus.COMPLETED);
                session.setFinalOutcome(CallOutcome.INVALID_NUMBER);
                session.setDoNotCallFurther(true);
                session.setCompletedAt(now);
                session.setNextAttemptAt(null);
            }
            case NO_ANSWER, BUSY, UNCERTAIN, CALL_FAILED ->
                    scheduleRetryOrFinalize(session, cfg, outcome, payload.failureReason(), now);
        }

        RtoRiskAssessmentDto updatedRisk = rtoRiskScoringService.assessOrder(order, customer, session);
        session.setUpdatedRtoRiskScore(updatedRisk.totalRiskScore());
        session.setUpdatedRtoRiskBand(updatedRisk.riskBand());
        session.setRecommendedAction(updatedRisk.recommendedAction());
        sessionRepository.save(session);

        recordEvent(
                session,
                attempt != null ? attempt.getId() : null,
                payload.eventId(),
                "OUTCOME_" + outcome.name(),
                actor,
                "Recorded call outcome " + outcome.name()
                        + " (sessionStatus=" + session.getStatus()
                        + ", updatedRtoScore=" + updatedRisk.totalRiskScore() + "/" + updatedRisk.riskBand() + ")",
                now);
    }

    private void scheduleRetryOrFinalize(
            CallSession session,
            CallingConfiguration cfg,
            CallOutcome outcome,
            String errorDetail,
            OffsetDateTime now) {
        session.setFinalOutcome(outcome);
        if (errorDetail != null && !errorDetail.isBlank()) {
            session.setLastError(errorDetail);
        }

        if (!session.isDoNotCallFurther() && session.getAttemptCount() < session.getMaxAttempts()) {
            int backoffMinutes = session.getAttemptCount() <= 1
                    ? cfg.getRetryBackoffMinutes1()
                    : cfg.getRetryBackoffMinutes2();
            OffsetDateTime nextTry = CallingDndPolicy.adjustForDnd(
                    now.plusMinutes(backoffMinutes),
                    cfg.getDndStartHourIst(),
                    cfg.getDndEndHourIst(),
                    cfg.getDndResumeMinuteIst());
            session.setStatus(CallSessionStatus.RETRY_SCHEDULED);
            session.setNextAttemptAt(nextTry);
            return;
        }

        session.setNextAttemptAt(null);
        session.setCompletedAt(now);
        session.setStatus(outcome == CallOutcome.CALL_FAILED ? CallSessionStatus.FAILED : CallSessionStatus.COMPLETED);

        if (outcome == CallOutcome.NO_ANSWER || outcome == CallOutcome.BUSY) {
            behaviouralEventRepository.save(new CustomerBehaviouralEvent(
                    UUID.randomUUID(),
                    session.getMerchantId(),
                    session.getCustomer().getId(),
                    session.getOrder().getId(),
                    CustomerBehaviouralEventType.CALL_NO_ANSWER,
                    "COD verification calls unanswered (" + session.getOrder().getOrderNumber() + ")",
                    "Customer did not answer across " + session.getAttemptCount() + " call attempt(s).",
                    now));
        }
    }

    private CallingConfiguration getOrCreateConfigEntity(UUID merchantId) {
        return configRepository.findByMerchantId(merchantId)
                .orElseGet(() -> configRepository.save(
                        new CallingConfiguration(merchantId, callingProperties.provider().toUpperCase(Locale.ROOT))));
    }

    private String resolveProviderCode(CallingConfiguration cfg) {
        String code = cfg.getProvider() != null ? cfg.getProvider().toUpperCase(Locale.ROOT) : SandboxVoiceCallingProvider.CODE;
        return providersByCode.containsKey(code) ? code : SandboxVoiceCallingProvider.CODE;
    }

    private void recordEvent(
            CallSession session,
            UUID attemptId,
            String webhookEventId,
            String eventType,
            String actor,
            String details,
            OffsetDateTime createdAt) {
        eventRepository.save(new CallEvent(
                session.getMerchantId(),
                session.getId(),
                attemptId,
                webhookEventId,
                eventType,
                actor != null ? actor : "SYSTEM",
                details,
                createdAt));
    }

    private CallQueueItemDto toQueueItemDto(CallSession s, List<OrderItem> items) {
        Order o = s.getOrder();
        Customer c = s.getCustomer();
        String primaryProduct = items.isEmpty()
                ? "COD Order"
                : items.get(0).getProductName() + (items.size() > 1 ? " (+" + (items.size() - 1) + " more)" : "");
        int effectiveScore = s.getUpdatedRtoRiskScore() != null
                ? s.getUpdatedRtoRiskScore()
                : s.getRtoRiskScoreSnapshot();
        String effectiveBand = s.getUpdatedRtoRiskBand() != null
                ? s.getUpdatedRtoRiskBand()
                : s.getRtoRiskBandSnapshot();

        return new CallQueueItemDto(
                s.getId(),
                o.getId(),
                o.getOrderNumber(),
                o.getOrderStatus(),
                o.getPaymentMethod(),
                o.getTotalAmount(),
                o.getCurrency(),
                primaryProduct,
                c.getId(),
                c.getFullName(),
                CallingDndPolicy.maskPhone(s.getPhoneNumber()),
                s.getPhoneNumber(),
                s.getLanguage(),
                effectiveScore,
                effectiveBand,
                s.getStatus(),
                s.getFinalOutcome(),
                s.getAttemptCount(),
                s.getMaxAttempts(),
                s.isDoNotCallFurther(),
                s.getRecommendedAction(),
                s.getLastAttemptAt(),
                s.getNextAttemptAt(),
                s.getCreatedAt());
    }

    private CallAttemptDto toAttemptDto(CallAttempt a) {
        return new CallAttemptDto(
                a.getId(),
                a.getAttemptNumber(),
                a.getProvider(),
                a.getProviderCallId(),
                a.getRoomName(),
                a.getStatus(),
                a.getOutcome(),
                a.getLanguage(),
                a.getDurationSeconds(),
                a.getRecordingUrl(),
                a.isConsentDisclosed(),
                a.getFailureReason(),
                a.getStartedAt(),
                a.getAnsweredAt(),
                a.getEndedAt());
    }

    private CallTranscriptTurnDto toTranscriptDto(CallTranscript t) {
        return new CallTranscriptTurnDto(
                t.getId(),
                t.getCallAttemptId(),
                t.getTurnIndex(),
                t.getSpeakerRole(),
                t.getUtteranceText(),
                t.getLanguage(),
                t.getConfidence(),
                t.getOccurredAt());
    }

    private CallEventDto toEventDto(CallEvent e) {
        return new CallEventDto(
                e.getId(),
                e.getCallAttemptId(),
                e.getEventType(),
                e.getActor(),
                e.getDetails(),
                e.getCreatedAt());
    }

    private CallingConfigurationDto toConfigDto(CallingConfiguration cfg) {
        List<String> langs = Arrays.stream(cfg.getSupportedLanguages().split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
        return new CallingConfigurationDto(
                cfg.getMerchantId(),
                cfg.isEnabled(),
                cfg.getProvider(),
                cfg.getDefaultLanguage(),
                langs,
                cfg.getMaxAttempts(),
                cfg.getRetryBackoffMinutes1(),
                cfg.getRetryBackoffMinutes2(),
                cfg.getCallTimeoutSeconds(),
                cfg.getDndStartHourIst(),
                cfg.getDndEndHourIst(),
                cfg.getDndResumeMinuteIst(),
                cfg.isAutoConfirmOrderOnYes(),
                cfg.isAutoCancelOrderOnRequest());
    }

    private static TranscriptSpeakerRole parseSpeakerRole(String raw) {
        if (raw == null) return TranscriptSpeakerRole.SYSTEM;
        return switch (raw.trim().toUpperCase(Locale.ROOT)) {
            case "ASSISTANT", "AGENT" -> TranscriptSpeakerRole.AGENT;
            case "USER", "CUSTOMER" -> TranscriptSpeakerRole.CUSTOMER;
            case "TOOL" -> TranscriptSpeakerRole.TOOL;
            default -> TranscriptSpeakerRole.SYSTEM;
        };
    }

    private static CallAttemptStatus mapAttemptStatus(CallOutcome outcome) {
        return switch (outcome) {
            case NO_ANSWER -> CallAttemptStatus.NO_ANSWER;
            case BUSY -> CallAttemptStatus.BUSY;
            case CALL_FAILED, INVALID_NUMBER -> CallAttemptStatus.FAILED;
            default -> CallAttemptStatus.COMPLETED;
        };
    }

    private static int defaultDurationForOutcome(CallOutcome outcome) {
        return switch (outcome) {
            case NO_ANSWER, BUSY, INVALID_NUMBER, CALL_FAILED -> 0;
            case CONFIRMED -> 52;
            case REJECTED -> 38;
            case CANCELLATION_REQUESTED -> 44;
            case HUMAN_ESCALATION -> 61;
            case UNCERTAIN -> 34;
        };
    }

    private static String defaultIntentForOutcome(CallOutcome outcome) {
        return switch (outcome) {
            case CONFIRMED -> "Confirmed Order & Delivery Availability";
            case REJECTED -> "Denied Placing Order";
            case CANCELLATION_REQUESTED -> "Requested Pre-Dispatch Order Cancellation";
            case NO_ANSWER -> "No Answer (Inconclusive)";
            case BUSY -> "Subscriber Busy";
            case UNCERTAIN -> "Unclear / Ambiguous Response";
            case INVALID_NUMBER -> "Invalid / Unreachable Number";
            case HUMAN_ESCALATION -> "Requested Live Support Specialist";
            case CALL_FAILED -> "Carrier / SIP Transport Error";
        };
    }

    private static String defaultSummaryForOutcome(Order order, CallOutcome outcome) {
        return switch (outcome) {
            case CONFIRMED -> "Buyer verified order " + order.getOrderNumber() + " (" + order.getTotalAmount()
                    + " " + order.getCurrency() + " COD), confirmed shipping address, and confirmed availability to pay cash on delivery.";
            case REJECTED -> "Recipient stated they did not place order " + order.getOrderNumber()
                    + ". Dispatch should be held for fraud/entry review.";
            case CANCELLATION_REQUESTED -> "Buyer confirmed placing order " + order.getOrderNumber()
                    + " but asked to cancel before dispatch. Further calls disabled.";
            case NO_ANSWER -> "Outbound call rang until timeout without answer. Automatic retry scheduled per merchant policy.";
            case BUSY -> "Subscriber line returned busy signal. Automatic retry scheduled.";
            case UNCERTAIN -> "Buyer answered but did not provide a clear yes/no confirmation before call ended.";
            case INVALID_NUMBER -> "Destination phone number rejected by carrier validation.";
            case HUMAN_ESCALATION -> "Buyer asked a policy/exchange question requiring a live customer support callback.";
            case CALL_FAILED -> "Telephony trunk failed to establish outbound call.";
        };
    }

    private static List<TranscriptTurnPayload> buildSimulatedTranscript(
            Order order,
            Customer customer,
            String lang,
            CallOutcome outcome,
            String customCustomerUtterance,
            OffsetDateTime now) {
        if (outcome == CallOutcome.NO_ANSWER || outcome == CallOutcome.BUSY
                || outcome == CallOutcome.CALL_FAILED || outcome == CallOutcome.INVALID_NUMBER) {
            return List.of(new TranscriptTurnPayload(
                    0, "SYSTEM", "Dialed " + CallingDndPolicy.maskPhone(customer.getPhoneNumber()) + " — outcome: " + outcome.name(),
                    lang, null, now));
        }

        boolean hindi = lang == null || lang.toLowerCase(Locale.ROOT).startsWith("hi");
        String greeting = hindi
                ? "Namaste " + customer.getFullName() + " ji, main Priya bol rahi hoon automated assistant ke roop mein. Yeh call quality ke liye record ki ja rahi hai. Aapne order "
                        + order.getOrderNumber() + " (" + order.getCurrency() + " " + order.getTotalAmount()
                        + " Cash on Delivery) place kiya hai, address: " + order.getShippingAddress()
                        + ". Kya aap yeh order confirm karte hain aur delivery lene ke liye available rahenge?"
                : "Hello " + customer.getFullName() + ", I am calling as an automated verification assistant (this call may be recorded). You placed COD order "
                        + order.getOrderNumber() + " for " + order.getCurrency() + " " + order.getTotalAmount()
                        + " to " + order.getShippingAddress()
                        + ". Would you like to confirm this order and confirm your availability for delivery?";

        String buyerLine = (customCustomerUtterance != null && !customCustomerUtterance.isBlank())
                ? customCustomerUtterance.trim()
                : switch (outcome) {
                    case CONFIRMED -> hindi
                            ? "Haan ji, maine hi order kiya hai. Address sahi hai, aap bhej dijiye."
                            : "Yes, I placed this order and the address is correct. Please ship it.";
                    case REJECTED -> hindi
                            ? "Nahi, maine aisa koi order nahi kiya hai."
                            : "No, I never placed this order.";
                    case CANCELLATION_REQUESTED -> hindi
                            ? "Maine galti se order kar diya tha, please isko cancel kar dijiye aur dobara call mat karna."
                            : "I ordered by mistake, please cancel this order.";
                    case HUMAN_ESCALATION -> hindi
                            ? "Mujhe size aur delivery timing ke baare mein aapke customer care agent se baat karni hai."
                            : "Could you connect me with a customer support agent regarding size and delivery?";
                    default -> hindi
                            ? "Abhi main bahar hoon, thoda clear nahi bata sakta."
                            : "I am currently driving and not sure right now.";
                };

        String closing = switch (outcome) {
            case CONFIRMED -> hindi
                    ? "Bahut dhanyawaad! Main aapka order confirm kar rahi hoon. Aapka din shubh ho."
                    : "Thank you! Your COD order is now confirmed for dispatch. Have a great day.";
            case REJECTED -> hindi
                    ? "Jankari ke liye dhanyawaad. Main is order ko verification review mein mark kar rahi hoon. Namaste."
                    : "Thank you for letting us know. We have flagged this order so it is not shipped to you.";
            case CANCELLATION_REQUESTED -> hindi
                    ? "Theek hai, main aapki cancellation request darj kar rahi hoon. Dhanyawaad."
                    : "Understood, I have recorded your cancellation request and stopped further calls. Thank you.";
            case HUMAN_ESCALATION -> hindi
                    ? "Bilkul, main aapki request hamari support team ko bhej rahi hoon, woh aapse sampark karenge. Dhanyawaad."
                    : "Certainly, I am escalating this to our support specialist who will reach out shortly. Thank you.";
            default -> hindi
                    ? "Koi baat nahi, dhanyawaad."
                    : "No problem, thank you for your time.";
        };

        return List.of(
                new TranscriptTurnPayload(0, "AGENT", greeting, lang, new BigDecimal("0.9900"), now.minusSeconds(25)),
                new TranscriptTurnPayload(1, "CUSTOMER", buyerLine, lang, new BigDecimal("0.9420"), now.minusSeconds(12)),
                new TranscriptTurnPayload(2, "AGENT", closing, lang, new BigDecimal("0.9900"), now.minusSeconds(3)));
    }
}
