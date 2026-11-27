package com.ordexa.intervention.controller;

import com.ordexa.common.response.ApiResponse;
import com.ordexa.common.response.PagedResponse;
import com.ordexa.intervention.dto.InterventionDtos.ActionDecisionRequest;
import com.ordexa.intervention.dto.InterventionDtos.CustomerConsentDto;
import com.ordexa.intervention.dto.InterventionDtos.ExecuteInterventionRequest;
import com.ordexa.intervention.dto.InterventionDtos.InterventionOverviewDto;
import com.ordexa.intervention.dto.InterventionDtos.InterventionPolicyDto;
import com.ordexa.intervention.dto.InterventionDtos.QueueItemDto;
import com.ordexa.intervention.dto.InterventionDtos.RecommendationDetailDto;
import com.ordexa.intervention.dto.InterventionDtos.RecommendationResponseDto;
import com.ordexa.intervention.dto.InterventionDtos.RecordOutcomeRequest;
import com.ordexa.intervention.dto.InterventionDtos.UpdateCustomerConsentRequest;
import com.ordexa.intervention.dto.InterventionDtos.UpdateInterventionPolicyRequest;
import com.ordexa.intervention.model.InterventionPriority;
import com.ordexa.intervention.model.InterventionStatus;
import com.ordexa.intervention.model.InterventionType;
import com.ordexa.intervention.service.InterventionApprovalService;
import com.ordexa.intervention.service.InterventionEngineService;
import com.ordexa.intervention.service.InterventionExecutionCoordinator;
import com.ordexa.intervention.service.InterventionOutcomeService;
import com.ordexa.intervention.service.InterventionRecommendationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST API surface for NORTHSTAR's Next-Best-Intervention Engine (NBIE).
 *
 * Authority Boundary:
 *   All endpoints operate strictly on pre-dispatch intervention recommendations,
 *   action-level approvals, sandbox executions, and outcomes. None of these endpoints
 *   approve, decline, cancel, hold, or release an order.
 */
@RestController
@RequestMapping("/api/v1/interventions")
@Tag(
        name = "Next-Best-Intervention Engine (NBIE)",
        description = "Deterministic, explainable pre-dispatch intervention recommendations (recommendations only — no order decisions)"
)
public class InterventionController {

    private final InterventionEngineService engineService;
    private final InterventionRecommendationService recommendationService;
    private final InterventionApprovalService approvalService;
    private final InterventionExecutionCoordinator executionCoordinator;
    private final InterventionOutcomeService outcomeService;
    private final Clock clock;

    public InterventionController(
            InterventionEngineService engineService,
            InterventionRecommendationService recommendationService,
            InterventionApprovalService approvalService,
            InterventionExecutionCoordinator executionCoordinator,
            InterventionOutcomeService outcomeService,
            Clock clock) {
        this.engineService = engineService;
        this.recommendationService = recommendationService;
        this.approvalService = approvalService;
        this.executionCoordinator = executionCoordinator;
        this.outcomeService = outcomeService;
        this.clock = clock;
    }

    @GetMapping("/overview")
    @PreAuthorize("@tenantAuth.hasMinimumRole('VIEWER')")
    @Operation(summary = "Get merchant-scoped NBIE queue KPIs and active ruleset metadata")
    public ResponseEntity<ApiResponse<InterventionOverviewDto>> getOverview() {
        return ResponseEntity.ok(ApiResponse.success(
                "Intervention overview retrieved",
                recommendationService.getOverview(),
                clock));
    }

    @PostMapping("/orders/{orderId}/evaluate")
    @PreAuthorize("@tenantAuth.hasMinimumRole('OPERATOR')")
    @Operation(summary = "Evaluate and idempotently persist NBIE intervention recommendation for an order")
    public ResponseEntity<ApiResponse<RecommendationResponseDto>> evaluateOrder(
            @PathVariable UUID orderId,
            @RequestParam(defaultValue = "false") boolean forceRefresh,
            HttpServletRequest servletRequest) {
        RecommendationResponseDto res = engineService.evaluateForActiveMerchant(
                orderId, forceRefresh, servletRequest.getRemoteAddr());
        return ResponseEntity.ok(ApiResponse.success(
                "Intervention evaluation completed (recommendation only — order status unchanged)",
                res,
                clock));
    }

    @GetMapping("/orders/{orderId}/recommendations")
    @PreAuthorize("@tenantAuth.hasMinimumRole('VIEWER')")
    @Operation(summary = "List NBIE recommendation history for a merchant order")
    public ResponseEntity<ApiResponse<List<RecommendationResponseDto>>> listOrderRecommendations(
            @PathVariable UUID orderId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Order intervention recommendations retrieved",
                recommendationService.getRecommendationsForOrder(orderId),
                clock));
    }

    @GetMapping("/recommendations/{recommendationId}")
    @PreAuthorize("@tenantAuth.hasMinimumRole('VIEWER')")
    @Operation(summary = "Get full NBIE recommendation detail including evidence snapshot, approvals, executions, outcomes, and audit trail")
    public ResponseEntity<ApiResponse<RecommendationDetailDto>> getRecommendationDetail(
            @PathVariable UUID recommendationId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Intervention recommendation detail retrieved",
                recommendationService.getRecommendationDetail(recommendationId),
                clock));
    }

    @GetMapping("/queue")
    @PreAuthorize("@tenantAuth.hasMinimumRole('VIEWER')")
    @Operation(summary = "List merchant NBIE recommendation queue with bucket, type, priority, status, and search filters")
    public ResponseEntity<ApiResponse<PagedResponse<QueueItemDto>>> listQueue(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String bucket,
            @RequestParam(required = false) InterventionStatus status,
            @RequestParam(required = false) InterventionType type,
            @RequestParam(required = false) InterventionPriority priority,
            @RequestParam(required = false) Boolean activeOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size,
            @RequestParam(defaultValue = "evaluatedAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        PagedResponse<QueueItemDto> res = recommendationService.listQueue(
                search, bucket, status, type, priority, activeOnly, page, size, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success("Intervention queue retrieved", res, clock));
    }

    @PostMapping("/items/{itemId}/approve")
    @PreAuthorize("@tenantAuth.hasMinimumRole('OPERATOR')")
    @Operation(summary = "Approve an intervention action ONLY (never approves or releases the order)")
    public ResponseEntity<ApiResponse<RecommendationDetailDto>> approveAction(
            @PathVariable UUID itemId,
            @Valid @RequestBody(required = false) ActionDecisionRequest request,
            HttpServletRequest servletRequest) {
        RecommendationDetailDto updated = approvalService.approveAction(
                itemId, request, servletRequest.getRemoteAddr());
        return ResponseEntity.ok(ApiResponse.success(
                "Intervention action approved (order status unchanged)",
                updated,
                clock));
    }

    @PostMapping("/items/{itemId}/reject")
    @PreAuthorize("@tenantAuth.hasMinimumRole('OPERATOR')")
    @Operation(summary = "Reject an intervention action ONLY (never cancels, declines, or holds the order)")
    public ResponseEntity<ApiResponse<RecommendationDetailDto>> rejectAction(
            @PathVariable UUID itemId,
            @Valid @RequestBody(required = false) ActionDecisionRequest request,
            HttpServletRequest servletRequest) {
        RecommendationDetailDto updated = approvalService.rejectAction(
                itemId, request, servletRequest.getRemoteAddr());
        return ResponseEntity.ok(ApiResponse.success(
                "Intervention action rejected (order status unchanged)",
                updated,
                clock));
    }

    @PostMapping("/items/{itemId}/execute")
    @PreAuthorize("@tenantAuth.hasMinimumRole('OPERATOR')")
    @Operation(summary = "Execute an approved intervention action via sandbox adapter after re-checking consent and policy")
    public ResponseEntity<ApiResponse<RecommendationDetailDto>> executeAction(
            @PathVariable UUID itemId,
            @Valid @RequestBody(required = false) ExecuteInterventionRequest request,
            HttpServletRequest servletRequest) {
        RecommendationDetailDto updated = executionCoordinator.executeApprovedItem(
                itemId, request, servletRequest.getRemoteAddr());
        return ResponseEntity.ok(ApiResponse.success(
                "Intervention executed in sandbox mode (awaiting verified outcome)",
                updated,
                clock));
    }

    @PostMapping("/items/{itemId}/outcomes")
    @PreAuthorize("@tenantAuth.hasMinimumRole('OPERATOR')")
    @Operation(summary = "Record a structured intervention outcome and optionally refresh NBIE evaluation")
    public ResponseEntity<ApiResponse<RecommendationDetailDto>> recordOutcome(
            @PathVariable UUID itemId,
            @Valid @RequestBody RecordOutcomeRequest request,
            HttpServletRequest servletRequest) {
        RecommendationDetailDto updated = outcomeService.recordOutcome(
                itemId, request, servletRequest.getRemoteAddr());
        return ResponseEntity.ok(ApiResponse.success(
                "Intervention outcome recorded",
                updated,
                clock));
    }

    @PostMapping("/recommendations/{id}/refresh")
    @PreAuthorize("@tenantAuth.hasMinimumRole('OPERATOR')")
    @Operation(summary = "Re-evaluate an order's NBIE recommendation after material evidence or outcome changes")
    public ResponseEntity<ApiResponse<RecommendationDetailDto>> refreshRecommendation(
            @PathVariable("id") UUID recommendationId,
            HttpServletRequest servletRequest) {
        RecommendationDetailDto refreshed = recommendationService.refreshRecommendation(
                recommendationId, servletRequest.getRemoteAddr());
        return ResponseEntity.ok(ApiResponse.success(
                "Intervention recommendation refreshed",
                refreshed,
                clock));
    }

    @GetMapping("/policy")
    @PreAuthorize("@tenantAuth.hasMinimumRole('VIEWER')")
    @Operation(summary = "Get merchant-scoped NBIE intervention policy")
    public ResponseEntity<ApiResponse<InterventionPolicyDto>> getPolicy() {
        return ResponseEntity.ok(ApiResponse.success(
                "Intervention policy retrieved",
                recommendationService.getPolicy(),
                clock));
    }

    @PutMapping("/policy")
    @PreAuthorize("@tenantAuth.hasMinimumRole('ADMIN')")
    @Operation(summary = "Update merchant-scoped NBIE intervention policy (ADMIN or OWNER)")
    public ResponseEntity<ApiResponse<InterventionPolicyDto>> updatePolicy(
            @Valid @RequestBody UpdateInterventionPolicyRequest request,
            HttpServletRequest servletRequest) {
        return ResponseEntity.ok(ApiResponse.success(
                "Intervention policy updated",
                recommendationService.updatePolicy(request, servletRequest.getRemoteAddr()),
                clock));
    }

    @GetMapping("/customers/{customerId}/consent")
    @PreAuthorize("@tenantAuth.hasMinimumRole('VIEWER')")
    @Operation(summary = "Get merchant-scoped customer communication consent and DNC state")
    public ResponseEntity<ApiResponse<CustomerConsentDto>> getCustomerConsent(
            @PathVariable UUID customerId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Customer consent status retrieved",
                recommendationService.getCustomerConsent(customerId),
                clock));
    }

    @PutMapping("/customers/{customerId}/consent")
    @PreAuthorize("@tenantAuth.hasMinimumRole('OPERATOR')")
    @Operation(summary = "Record verified customer communication consent provenance for NBIE feasibility")
    public ResponseEntity<ApiResponse<CustomerConsentDto>> updateCustomerConsent(
            @PathVariable UUID customerId,
            @Valid @RequestBody UpdateCustomerConsentRequest request,
            HttpServletRequest servletRequest) {
        return ResponseEntity.ok(ApiResponse.success(
                "Customer consent status updated",
                recommendationService.updateCustomerConsent(customerId, request, servletRequest.getRemoteAddr()),
                clock));
    }
}
