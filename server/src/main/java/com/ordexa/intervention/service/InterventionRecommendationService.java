package com.ordexa.intervention.service;

import com.ordexa.calling.entity.CustomerCallingPreference;
import com.ordexa.calling.repository.CustomerCallingPreferenceRepository;
import com.ordexa.calling.service.CallingDndPolicy;
import com.ordexa.common.exception.ErrorCode;
import com.ordexa.common.exception.OrdexaException;
import com.ordexa.common.exception.ResourceNotFoundException;
import com.ordexa.common.response.PagedResponse;
import com.ordexa.common.validation.PaginationValidator;
import com.ordexa.customer.entity.Customer;
import com.ordexa.customer.repository.CustomerRepository;
import com.ordexa.intervention.assembler.InterventionInputAssembler;
import com.ordexa.intervention.config.NbieProperties;
import com.ordexa.intervention.dto.InterventionDtos.ApprovalHistoryDto;
import com.ordexa.intervention.dto.InterventionDtos.AuditEventDto;
import com.ordexa.intervention.dto.InterventionDtos.CustomerConsentDto;
import com.ordexa.intervention.dto.InterventionDtos.ExecutionLogDto;
import com.ordexa.intervention.dto.InterventionDtos.InterventionOverviewDto;
import com.ordexa.intervention.dto.InterventionDtos.InterventionPolicyDto;
import com.ordexa.intervention.dto.InterventionDtos.OutcomeRecordDto;
import com.ordexa.intervention.dto.InterventionDtos.QueueItemDto;
import com.ordexa.intervention.dto.InterventionDtos.RecommendationDetailDto;
import com.ordexa.intervention.dto.InterventionDtos.RecommendationResponseDto;
import com.ordexa.intervention.dto.InterventionDtos.UpdateCustomerConsentRequest;
import com.ordexa.intervention.dto.InterventionDtos.UpdateInterventionPolicyRequest;
import com.ordexa.intervention.entity.InterventionCustomerConsent;
import com.ordexa.intervention.entity.InterventionPolicy;
import com.ordexa.intervention.entity.InterventionRecommendation;
import com.ordexa.intervention.entity.InterventionRecommendationItem;
import com.ordexa.intervention.model.InterventionEnums.ConsentStatus;
import com.ordexa.intervention.model.InterventionEnums.InterventionChannel;
import com.ordexa.intervention.model.InterventionEnums.InterventionItemRole;
import com.ordexa.intervention.model.InterventionPriority;
import com.ordexa.intervention.model.InterventionStatus;
import com.ordexa.intervention.model.InterventionType;
import com.ordexa.intervention.repository.InterventionApprovalRepository;
import com.ordexa.intervention.repository.InterventionAuditEventRepository;
import com.ordexa.intervention.repository.InterventionCustomerConsentRepository;
import com.ordexa.intervention.repository.InterventionExecutionLogRepository;
import com.ordexa.intervention.repository.InterventionOutcomeRepository;
import com.ordexa.intervention.repository.InterventionPolicyRepository;
import com.ordexa.intervention.repository.InterventionRecommendationRepository;
import com.ordexa.order.entity.Order;
import com.ordexa.order.repository.OrderRepository;
import com.ordexa.tenant.context.TenantContext;
import com.ordexa.tenant.context.TenantContextHolder;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InterventionRecommendationService {

    private static final Set<String> ALLOWED_SORT_FIELDS =
            Set.of("evaluatedAt", "createdAt", "rtoScore", "expiresAt");

    private final InterventionRecommendationRepository recommendationRepository;
    private final InterventionApprovalRepository approvalRepository;
    private final InterventionExecutionLogRepository executionLogRepository;
    private final InterventionOutcomeRepository outcomeRepository;
    private final InterventionAuditEventRepository auditEventRepository;
    private final InterventionPolicyRepository policyRepository;
    private final InterventionCustomerConsentRepository consentRepository;
    private final CustomerCallingPreferenceRepository callingPreferenceRepository;
    private final OrderRepository orderRepository;
    private final CustomerRepository customerRepository;
    private final InterventionEngineService engineService;
    private final InterventionAuditService auditService;
    private final NbieProperties nbieProperties;
    private final Clock clock;

    public InterventionRecommendationService(
            InterventionRecommendationRepository recommendationRepository,
            InterventionApprovalRepository approvalRepository,
            InterventionExecutionLogRepository executionLogRepository,
            InterventionOutcomeRepository outcomeRepository,
            InterventionAuditEventRepository auditEventRepository,
            InterventionPolicyRepository policyRepository,
            InterventionCustomerConsentRepository consentRepository,
            CustomerCallingPreferenceRepository callingPreferenceRepository,
            OrderRepository orderRepository,
            CustomerRepository customerRepository,
            InterventionEngineService engineService,
            InterventionAuditService auditService,
            NbieProperties nbieProperties,
            Clock clock) {
        this.recommendationRepository = recommendationRepository;
        this.approvalRepository = approvalRepository;
        this.executionLogRepository = executionLogRepository;
        this.outcomeRepository = outcomeRepository;
        this.auditEventRepository = auditEventRepository;
        this.policyRepository = policyRepository;
        this.consentRepository = consentRepository;
        this.callingPreferenceRepository = callingPreferenceRepository;
        this.orderRepository = orderRepository;
        this.customerRepository = customerRepository;
        this.engineService = engineService;
        this.auditService = auditService;
        this.nbieProperties = nbieProperties;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public InterventionOverviewDto getOverview() {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        List<InterventionRecommendation> actives =
                recommendationRepository.findByMerchantIdAndActiveRecordTrue(ctx.merchantId());

        long activeCount = actives.size();
        long awaitingApproval = actives.stream()
                .filter(r -> r.getStatus() == InterventionStatus.ACTION_APPROVAL_PENDING)
                .count();
        long awaitingExecOrOutcome = actives.stream()
                .filter(r -> r.getStatus() == InterventionStatus.ACTION_APPROVED
                        || r.getStatus() == InterventionStatus.EXECUTION_PENDING
                        || r.getStatus() == InterventionStatus.EXECUTED
                        || r.getStatus() == InterventionStatus.OUTCOME_PENDING)
                .count();
        long completed = actives.stream()
                .filter(r -> r.getStatus() == InterventionStatus.COMPLETED)
                .count();
        long highPriority = actives.stream()
                .filter(r -> r.getItems().stream()
                        .anyMatch(i -> i.getItemRole() == InterventionItemRole.PRIMARY
                                && i.getPriority() == InterventionPriority.HIGH
                                && !i.getStatus().isTerminal()))
                .count();

        return new InterventionOverviewDto(
                activeCount,
                awaitingApproval,
                awaitingExecOrOutcome,
                completed,
                highPriority,
                nbieProperties.getRulesetVersion(),
                nbieProperties.isSandboxOnly());
    }

    @Transactional(readOnly = true)
    public PagedResponse<QueueItemDto> listQueue(
            String search,
            String queueBucket,
            InterventionStatus status,
            InterventionType interventionType,
            InterventionPriority priority,
            Boolean activeOnly,
            int page,
            int size,
            String sortBy,
            String sortDir) {

        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        PaginationValidator.validate(page, size);

        String resolvedSort = (sortBy != null && ALLOWED_SORT_FIELDS.contains(sortBy))
                ? sortBy
                : "evaluatedAt";
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDir) ? Sort.Direction.ASC : Sort.Direction.DESC;

        Specification<InterventionRecommendation> spec = (root, query, cb) -> {
            if (query != null && query.getResultType() != Long.class && query.getResultType() != long.class) {
                root.fetch("order", JoinType.INNER);
                root.fetch("customer", JoinType.INNER);
                query.distinct(true);
            } else if (query != null) {
                query.distinct(true);
            }

            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("merchantId"), ctx.merchantId()));

            boolean effectiveActiveOnly = activeOnly == null || activeOnly;
            if (effectiveActiveOnly && (queueBucket == null || !"ALL_HISTORY".equalsIgnoreCase(queueBucket))) {
                predicates.add(cb.isTrue(root.get("activeRecord")));
            }

            if (queueBucket != null && !queueBucket.isBlank()) {
                switch (queueBucket.trim().toUpperCase(Locale.ROOT)) {
                    case "AWAITING_APPROVAL" ->
                            predicates.add(cb.equal(root.get("status"), InterventionStatus.ACTION_APPROVAL_PENDING));
                    case "AWAITING_EXECUTION_OR_OUTCOME" ->
                            predicates.add(root.get("status").in(
                                    InterventionStatus.ACTION_APPROVED,
                                    InterventionStatus.EXECUTION_PENDING,
                                    InterventionStatus.EXECUTING,
                                    InterventionStatus.EXECUTED,
                                    InterventionStatus.OUTCOME_PENDING));
                    case "RECENTLY_COMPLETED" ->
                            predicates.add(root.get("status").in(
                                    InterventionStatus.COMPLETED,
                                    InterventionStatus.ACTION_REJECTED));
                    case "ACTIVE" ->
                            predicates.add(root.get("status").in(
                                    InterventionStatus.RECOMMENDED,
                                    InterventionStatus.ACTION_APPROVAL_PENDING,
                                    InterventionStatus.ACTION_APPROVED,
                                    InterventionStatus.EXECUTION_PENDING,
                                    InterventionStatus.EXECUTING,
                                    InterventionStatus.EXECUTED,
                                    InterventionStatus.OUTCOME_PENDING));
                    default -> {
                    }
                }
            }

            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }

            if (interventionType != null || priority != null) {
                Join<InterventionRecommendation, InterventionRecommendationItem> itemJoin =
                        root.join("items", JoinType.INNER);
                if (interventionType != null) {
                    predicates.add(cb.equal(itemJoin.get("interventionType"), interventionType));
                }
                if (priority != null) {
                    predicates.add(cb.equal(itemJoin.get("priority"), priority));
                }
            }

            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
                Join<InterventionRecommendation, Order> orderJoin = root.join("order", JoinType.INNER);
                Join<InterventionRecommendation, Customer> customerJoin = root.join("customer", JoinType.INNER);
                predicates.add(cb.or(
                        cb.like(cb.lower(orderJoin.get("orderNumber")), pattern),
                        cb.like(cb.lower(customerJoin.get("fullName")), pattern)));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<InterventionRecommendation> recPage = recommendationRepository.findAll(
                spec, PageRequest.of(page, size, Sort.by(direction, resolvedSort)));

        List<QueueItemDto> dtos = recPage.getContent().stream()
                .map(this::toQueueItemDto)
                .toList();

        return new PagedResponse<>(
                dtos,
                recPage.getNumber(),
                recPage.getSize(),
                recPage.getTotalElements(),
                recPage.getTotalPages(),
                recPage.hasNext());
    }

    @Transactional(readOnly = true)
    public List<RecommendationResponseDto> getRecommendationsForOrder(UUID orderId) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        orderRepository.findByIdAndMerchantIdWithCustomer(orderId, ctx.merchantId())
                .orElseThrow(() -> new ResourceNotFoundException("Order not found in active merchant workspace"));

        return recommendationRepository
                .findByMerchantIdAndOrderIdWithDetailsOrderByEvaluatedAtDesc(ctx.merchantId(), orderId)
                .stream()
                .map(engineService::toResponseDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public RecommendationDetailDto getRecommendationDetail(UUID recommendationId) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        return loadDetailForMerchant(ctx.merchantId(), recommendationId);
    }

    @Transactional(readOnly = true)
    public RecommendationDetailDto loadDetailForMerchant(UUID merchantId, UUID recommendationId) {
        InterventionRecommendation rec = recommendationRepository
                .findByIdAndMerchantIdWithDetails(recommendationId, merchantId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Intervention recommendation not found in active merchant workspace"));

        List<ApprovalHistoryDto> approvals = approvalRepository
                .findByMerchantIdAndRecommendationIdOrderByCreatedAtAsc(merchantId, recommendationId)
                .stream()
                .map(a -> new ApprovalHistoryDto(
                        a.getId(),
                        a.getItemId(),
                        a.getActorUserId(),
                        a.getActorRole(),
                        a.getDecision(),
                        a.getNote(),
                        a.getCreatedAt()))
                .toList();

        List<ExecutionLogDto> executions = executionLogRepository
                .findByMerchantIdAndRecommendationIdOrderByExecutedAtAsc(merchantId, recommendationId)
                .stream()
                .map(e -> new ExecutionLogDto(
                        e.getId(),
                        e.getItemId(),
                        e.getIdempotencyKey(),
                        e.getAdapterCode(),
                        e.getChannel(),
                        e.getProviderMode(),
                        e.getExecutionStatus(),
                        e.getExternalReferenceId(),
                        e.getSanitizedMetadata(),
                        e.getExecutedAt()))
                .toList();

        List<OutcomeRecordDto> outcomes = outcomeRepository
                .findByMerchantIdAndRecommendationIdOrderByRecordedAtAsc(merchantId, recommendationId)
                .stream()
                .map(o -> new OutcomeRecordDto(
                        o.getId(),
                        o.getItemId(),
                        o.getOutcomeType(),
                        o.getOutcomeSource(),
                        o.isVerifiedResponse(),
                        o.getMinimizedPayload(),
                        o.getRecordedAt()))
                .toList();

        List<AuditEventDto> audits = auditEventRepository
                .findByMerchantIdAndRecommendationIdOrderByCreatedAtAsc(merchantId, recommendationId)
                .stream()
                .map(ev -> new AuditEventDto(
                        ev.getId(),
                        ev.getItemId(),
                        ev.getActorLabel(),
                        ev.getEventType(),
                        ev.getRulesetVersion(),
                        ev.getCorrelationId(),
                        ev.getSummary(),
                        ev.getEventMetadata(),
                        ev.getCreatedAt()))
                .toList();

        return new RecommendationDetailDto(
                engineService.toResponseDto(rec),
                approvals,
                executions,
                outcomes,
                audits);
    }

    @Transactional
    public RecommendationDetailDto refreshRecommendation(UUID recommendationId, String clientIp) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        InterventionRecommendation existing = recommendationRepository
                .findByIdAndMerchantIdWithDetails(recommendationId, ctx.merchantId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Intervention recommendation not found in active merchant workspace"));

        RecommendationResponseDto refreshed = engineService.evaluateInternal(
                ctx.merchantId(),
                existing.getOrder().getId(),
                ctx.userId(),
                ctx.fullName(),
                true,
                clientIp);

        return loadDetailForMerchant(ctx.merchantId(), refreshed.recommendationId());
    }

    @Transactional
    public InterventionPolicyDto getPolicy() {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        InterventionPolicy entity = policyRepository.findByMerchantId(ctx.merchantId())
                .orElseGet(() -> policyRepository.save(new InterventionPolicy(ctx.merchantId())));
        return toPolicyDto(entity);
    }

    @Transactional
    public InterventionPolicyDto updatePolicy(UpdateInterventionPolicyRequest req, String clientIp) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        InterventionPolicy entity = policyRepository.findByMerchantId(ctx.merchantId())
                .orElseGet(() -> new InterventionPolicy(ctx.merchantId()));

        List<String> validChannels = new ArrayList<>();
        for (String raw : req.enabledChannels()) {
            if (raw == null || raw.isBlank()) {
                continue;
            }
            try {
                InterventionChannel ch = InterventionChannel.valueOf(raw.trim().toUpperCase(Locale.ROOT));
                if (ch != InterventionChannel.NONE) {
                    validChannels.add(ch.name());
                }
            } catch (IllegalArgumentException ex) {
                throw new OrdexaException(
                        "Unsupported NBIE channel: " + raw + ". Permitted: VOICE_SANDBOX, INTERNAL_QUEUE",
                        ErrorCode.VALIDATION_ERROR,
                        HttpStatus.BAD_REQUEST);
            }
        }

        entity.setEnabled(req.enabled());
        entity.setCodConfirmationEnabled(req.codConfirmationEnabled());
        entity.setAddressClarificationEnabled(req.addressClarificationEnabled());
        entity.setHumanReviewEnabled(req.humanReviewEnabled());
        entity.setPartialAdvanceEnabled(req.partialAdvanceEnabled());
        entity.setPartialAdvancePaymentCapable(req.partialAdvancePaymentCapable());
        entity.setPartialAdvanceMinOrderValue(req.partialAdvanceMinOrderValue());
        entity.setCodConfirmationMinOrderValue(req.codConfirmationMinOrderValue());
        entity.setEnabledChannels(validChannels.isEmpty() ? "VOICE_SANDBOX" : String.join(",", validChannels));
        entity.setMaxContactsPerOrder(req.maxContactsPerOrder());
        entity.setMaxContactsPerCustomer24h(req.maxContactsPerCustomer24h());
        entity.setMinHoursBetweenContacts(req.minHoursBetweenContacts());
        entity.setRecommendationTtlHours(req.recommendationTtlHours());
        entity.setMaxRtoAssessmentAgeMinutes(req.maxRtoAssessmentAgeMinutes());
        entity.setRequireApprovalForContact(req.requireApprovalForContact());

        InterventionPolicy saved = policyRepository.save(entity);
        return toPolicyDto(saved);
    }

    @Transactional(readOnly = true)
    public CustomerConsentDto getCustomerConsent(UUID customerId) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        customerRepository.findByIdAndMerchantId(customerId, ctx.merchantId())
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found in active merchant workspace"));

        boolean dnc = callingPreferenceRepository
                .findByMerchantIdAndCustomerId(ctx.merchantId(), customerId)
                .map(CustomerCallingPreference::isOptedOut)
                .orElse(false);

        InterventionCustomerConsent consent = consentRepository
                .findByMerchantIdAndCustomerId(ctx.merchantId(), customerId)
                .orElse(null);

        ConsentStatus effective = dnc
                ? ConsentStatus.DENIED
                : (consent != null ? consent.getConsentStatus() : ConsentStatus.UNKNOWN);

        List<String> channels = (!dnc && consent != null)
                ? InterventionInputAssembler.parseChannels(consent.getPermittedChannels()).stream()
                        .map(Enum::name)
                        .toList()
                : List.of();

        return new CustomerConsentDto(
                customerId,
                effective,
                dnc,
                channels,
                dnc ? "CUSTOMER_CALLING_OPT_OUT" : (consent != null ? consent.getConsentSource() : "NO_CONSENT_RECORD"),
                consent != null ? consent.getRecordedAt() : null);
    }

    @Transactional
    public CustomerConsentDto updateCustomerConsent(
            UUID customerId,
            UpdateCustomerConsentRequest req,
            String clientIp) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        customerRepository.findByIdAndMerchantId(customerId, ctx.merchantId())
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found in active merchant workspace"));

        OffsetDateTime now = OffsetDateTime.now(clock);
        String channelsCsv = (req.permittedChannels() != null && !req.permittedChannels().isEmpty())
                ? String.join(",", req.permittedChannels())
                : "VOICE_SANDBOX";
        String source = (req.consentSource() != null && !req.consentSource().isBlank())
                ? req.consentSource().trim()
                : "OPERATOR_VERIFIED";

        InterventionCustomerConsent entity = consentRepository
                .findByMerchantIdAndCustomerId(ctx.merchantId(), customerId)
                .map(existing -> {
                    existing.updateConsent(req.consentStatus(), channelsCsv, source, ctx.userId(), now);
                    return existing;
                })
                .orElseGet(() -> new InterventionCustomerConsent(
                        ctx.merchantId(),
                        customerId,
                        req.consentStatus(),
                        channelsCsv,
                        source,
                        ctx.userId(),
                        now));

        consentRepository.save(entity);
        return getCustomerConsent(customerId);
    }

    private QueueItemDto toQueueItemDto(InterventionRecommendation rec) {
        Order order = rec.getOrder();
        Customer customer = rec.getCustomer();
        List<InterventionRecommendationItem> items = rec.getItems();
        InterventionRecommendationItem primary = items.stream()
                .filter(i -> i.getItemRole() == InterventionItemRole.PRIMARY)
                .findFirst()
                .orElse(items.isEmpty() ? null : items.get(0));

        return new QueueItemDto(
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
                rec.getRtoScore(),
                rec.getRtoBand(),
                primary != null ? primary.getId() : null,
                primary != null ? primary.getInterventionType() : null,
                primary != null ? primary.getPriority() : InterventionPriority.NONE,
                primary != null ? primary.getStatus() : null,
                primary != null && primary.isApprovalRequired(),
                rec.getEvidenceCompleteness(),
                rec.getRulesetVersion(),
                rec.getEvaluatedAt(),
                rec.getExpiresAt());
    }

    private InterventionPolicyDto toPolicyDto(InterventionPolicy entity) {
        List<String> channels = InterventionInputAssembler.parseChannels(entity.getEnabledChannels())
                .stream()
                .map(Enum::name)
                .toList();
        return new InterventionPolicyDto(
                entity.getMerchantId(),
                entity.isEnabled(),
                entity.isCodConfirmationEnabled(),
                entity.isAddressClarificationEnabled(),
                entity.isHumanReviewEnabled(),
                entity.isPartialAdvanceEnabled(),
                entity.isPartialAdvancePaymentCapable(),
                entity.getPartialAdvanceMinOrderValue(),
                entity.getCodConfirmationMinOrderValue(),
                channels,
                entity.getMaxContactsPerOrder(),
                entity.getMaxContactsPerCustomer24h(),
                entity.getMinHoursBetweenContacts(),
                entity.getRecommendationTtlHours(),
                entity.getMaxRtoAssessmentAgeMinutes(),
                entity.isRequireApprovalForContact());
    }
}
