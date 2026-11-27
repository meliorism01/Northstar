package com.ordexa.calling.controller;

import com.ordexa.calling.dto.CallingDtos.CallQueueItemDto;
import com.ordexa.calling.dto.CallingDtos.CallSessionDetailDto;
import com.ordexa.calling.dto.CallingDtos.CallingConfigurationDto;
import com.ordexa.calling.dto.CallingDtos.CallingOverviewDto;
import com.ordexa.calling.dto.CallingDtos.ManualCallActionRequest;
import com.ordexa.calling.dto.CallingDtos.SimulateCallOutcomeRequest;
import com.ordexa.calling.dto.CallingDtos.SyncEligibleOrdersResponse;
import com.ordexa.calling.dto.CallingDtos.UpdateCallingConfigurationRequest;
import com.ordexa.calling.entity.CallOutcome;
import com.ordexa.calling.entity.CallSessionStatus;
import com.ordexa.calling.service.CallingWorkflowService;
import com.ordexa.common.response.ApiResponse;
import com.ordexa.common.response.PagedResponse;
import com.ordexa.risk.RtoRiskAssessmentDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
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

@RestController
@RequestMapping("/api/v1/calling")
@Tag(name = "Calling Intelligence", description = "Merchant-scoped AI COD Calling Queue, Transcripts, Controls, and RTO Risk Integration")
public class CallingController {

    private final CallingWorkflowService callingService;
    private final Clock clock;

    public CallingController(CallingWorkflowService callingService, Clock clock) {
        this.callingService = callingService;
        this.clock = clock;
    }

    @GetMapping("/overview")
    @PreAuthorize("@tenantAuth.hasMinimumRole('VIEWER')")
    @Operation(summary = "Get merchant-scoped AI COD calling overview KPIs")
    public ResponseEntity<ApiResponse<CallingOverviewDto>> getOverview() {
        return ResponseEntity.ok(ApiResponse.success(
                "Calling intelligence overview retrieved",
                callingService.getOverview(),
                clock));
    }

    @GetMapping("/sessions")
    @PreAuthorize("@tenantAuth.hasMinimumRole('VIEWER')")
    @Operation(summary = "List COD calling queue with filtering by outcome, status, RTO risk band, date, and search")
    public ResponseEntity<ApiResponse<PagedResponse<CallQueueItemDto>>> listSessions(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) CallSessionStatus status,
            @RequestParam(required = false) CallOutcome outcome,
            @RequestParam(required = false) String riskBand,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime toDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        PagedResponse<CallQueueItemDto> result = callingService.listQueue(
                search, status, outcome, riskBand, fromDate, toDate, page, size, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success("Calling queue retrieved", result, clock));
    }

    @GetMapping("/sessions/{sessionId}")
    @PreAuthorize("@tenantAuth.hasMinimumRole('VIEWER')")
    @Operation(summary = "Get full call session details including attempts, transcript turns, timeline, and 4-pillar RTO assessment")
    public ResponseEntity<ApiResponse<CallSessionDetailDto>> getSessionDetail(@PathVariable UUID sessionId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Call session details retrieved",
                callingService.getSessionDetail(sessionId),
                clock));
    }

    @PostMapping("/sessions/{sessionId}/retry")
    @PreAuthorize("@tenantAuth.hasMinimumRole('OPERATOR')")
    @Operation(summary = "Manually initiate or retry an eligible COD verification call")
    public ResponseEntity<ApiResponse<CallSessionDetailDto>> retrySession(
            @PathVariable UUID sessionId,
            @RequestBody(required = false) ManualCallActionRequest request,
            HttpServletRequest servletRequest) {
        CallSessionDetailDto updated = callingService.manualRetryOrDispatch(
                sessionId, request, servletRequest.getRemoteAddr());
        return ResponseEntity.ok(ApiResponse.success("Call attempt initiated", updated, clock));
    }

    @PostMapping("/sessions/{sessionId}/stop")
    @PreAuthorize("@tenantAuth.hasMinimumRole('OPERATOR')")
    @Operation(summary = "Stop all future automated calls for this session (and optionally opt out customer)")
    public ResponseEntity<ApiResponse<CallSessionDetailDto>> stopSession(
            @PathVariable UUID sessionId,
            @RequestBody(required = false) ManualCallActionRequest request,
            HttpServletRequest servletRequest) {
        CallSessionDetailDto updated = callingService.stopFurtherCalls(
                sessionId, request, servletRequest.getRemoteAddr());
        return ResponseEntity.ok(ApiResponse.success("Future calls stopped", updated, clock));
    }

    @PostMapping("/sessions/{sessionId}/escalate")
    @PreAuthorize("@tenantAuth.hasMinimumRole('OPERATOR')")
    @Operation(summary = "Escalate COD verification session to a human operations specialist")
    public ResponseEntity<ApiResponse<CallSessionDetailDto>> escalateSession(
            @PathVariable UUID sessionId,
            @RequestBody(required = false) ManualCallActionRequest request,
            HttpServletRequest servletRequest) {
        CallSessionDetailDto updated = callingService.escalateToHuman(
                sessionId, request, servletRequest.getRemoteAddr());
        return ResponseEntity.ok(ApiResponse.success("Call session escalated to human specialist", updated, clock));
    }

    @PostMapping("/sessions/{sessionId}/simulate-outcome")
    @PreAuthorize("@tenantAuth.hasMinimumRole('OPERATOR')")
    @Operation(summary = "Simulate a structured conversational outcome and transcript in Sandbox mode")
    public ResponseEntity<ApiResponse<CallSessionDetailDto>> simulateOutcome(
            @PathVariable UUID sessionId,
            @Valid @RequestBody SimulateCallOutcomeRequest request,
            HttpServletRequest servletRequest) {
        CallSessionDetailDto updated = callingService.simulateOutcomeForMerchant(
                sessionId, request, servletRequest.getRemoteAddr());
        return ResponseEntity.ok(ApiResponse.success("Simulated call outcome processed", updated, clock));
    }

    @PostMapping("/sync-eligible-orders")
    @PreAuthorize("@tenantAuth.hasMinimumRole('OPERATOR')")
    @Operation(summary = "Idempotently enroll any existing CREATED COD orders in the workspace into the calling queue")
    public ResponseEntity<ApiResponse<SyncEligibleOrdersResponse>> syncEligibleOrders(
            @RequestParam(defaultValue = "true") boolean dispatchImmediate) {
        SyncEligibleOrdersResponse res = callingService.syncEligibleCodOrdersForActiveMerchant(dispatchImmediate);
        return ResponseEntity.ok(ApiResponse.success("Eligible COD orders synchronized", res, clock));
    }

    @GetMapping("/orders/{orderId}/rto-assessment")
    @PreAuthorize("@tenantAuth.hasMinimumRole('VIEWER')")
    @Operation(summary = "Evaluate 4-pillar RTO risk breakdown (behavioural, order, call outcome, historical confirmation)")
    public ResponseEntity<ApiResponse<RtoRiskAssessmentDto>> getOrderRtoAssessment(@PathVariable UUID orderId) {
        return ResponseEntity.ok(ApiResponse.success(
                "RTO risk assessment computed",
                callingService.getOrderRtoAssessment(orderId),
                clock));
    }

    @GetMapping("/configuration")
    @PreAuthorize("@tenantAuth.hasMinimumRole('VIEWER')")
    @Operation(summary = "Get merchant-scoped AI calling configuration")
    public ResponseEntity<ApiResponse<CallingConfigurationDto>> getConfiguration() {
        return ResponseEntity.ok(ApiResponse.success(
                "Calling configuration retrieved",
                callingService.getConfiguration(),
                clock));
    }

    @PutMapping("/configuration")
    @PreAuthorize("@tenantAuth.hasMinimumRole('ADMIN')")
    @Operation(summary = "Update merchant-scoped AI calling configuration (ADMIN or OWNER)")
    public ResponseEntity<ApiResponse<CallingConfigurationDto>> updateConfiguration(
            @Valid @RequestBody UpdateCallingConfigurationRequest request,
            HttpServletRequest servletRequest) {
        CallingConfigurationDto updated = callingService.updateConfiguration(
                request, servletRequest.getRemoteAddr());
        return ResponseEntity.ok(ApiResponse.success("Calling configuration updated", updated, clock));
    }
}
