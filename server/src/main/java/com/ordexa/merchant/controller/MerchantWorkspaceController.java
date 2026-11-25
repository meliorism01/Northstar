package com.ordexa.merchant.controller;

import com.ordexa.common.response.ApiResponse;
import com.ordexa.membership.dto.MemberSummaryDto;
import com.ordexa.membership.service.MembershipService;
import com.ordexa.merchant.dto.AddWorkspaceMemberRequest;
import com.ordexa.merchant.dto.MerchantWorkspaceDetailDto;
import com.ordexa.merchant.dto.UpdateMerchantRequest;
import com.ordexa.merchant.service.MerchantWorkspaceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/merchants")
@Tag(name = "Merchant Workspaces", description = "Tenant-isolated merchant workspace and team membership operations")
public class MerchantWorkspaceController {

    private final MerchantWorkspaceService merchantWorkspaceService;
    private final MembershipService membershipService;
    private final Clock clock;

    public MerchantWorkspaceController(
            MerchantWorkspaceService merchantWorkspaceService,
            MembershipService membershipService,
            Clock clock) {
        this.merchantWorkspaceService = merchantWorkspaceService;
        this.membershipService = membershipService;
        this.clock = clock;
    }

    @GetMapping("/current")
    @PreAuthorize("@tenantAuth.hasMinimumRole('VIEWER')")
    @Operation(summary = "Get active merchant workspace details")
    public ResponseEntity<ApiResponse<MerchantWorkspaceDetailDto>> getCurrentWorkspace() {
        MerchantWorkspaceDetailDto dto = merchantWorkspaceService.getCurrentWorkspaceDetails();
        return ResponseEntity.ok(ApiResponse.success("Active workspace retrieved", dto, clock));
    }

    @GetMapping("/{merchantId}")
    @PreAuthorize("@tenantAuth.hasAccessToMerchant(#merchantId, 'VIEWER')")
    @Operation(summary = "Get merchant workspace details by ID (enforces strict tenant isolation)")
    public ResponseEntity<ApiResponse<MerchantWorkspaceDetailDto>> getWorkspaceById(
            @PathVariable UUID merchantId) {
        MerchantWorkspaceDetailDto dto = merchantWorkspaceService.getWorkspaceDetails(merchantId);
        return ResponseEntity.ok(ApiResponse.success("Merchant workspace retrieved", dto, clock));
    }

    @PatchMapping("/{merchantId}")
    @PreAuthorize("@tenantAuth.hasAccessToMerchant(#merchantId, 'OWNER')")
    @Operation(summary = "Update merchant business name (OWNER only)")
    public ResponseEntity<ApiResponse<MerchantWorkspaceDetailDto>> updateWorkspace(
            @PathVariable UUID merchantId,
            @Valid @RequestBody UpdateMerchantRequest request,
            HttpServletRequest servletRequest) {
        MerchantWorkspaceDetailDto updated = merchantWorkspaceService.updateMerchantBusinessName(
                merchantId,
                request,
                servletRequest.getRemoteAddr());
        return ResponseEntity.ok(ApiResponse.success("Merchant workspace updated", updated, clock));
    }

    @GetMapping("/{merchantId}/members")
    @PreAuthorize("@tenantAuth.hasAccessToMerchant(#merchantId, 'VIEWER')")
    @Operation(summary = "List team members for the active merchant workspace")
    public ResponseEntity<ApiResponse<List<MemberSummaryDto>>> listMembers(
            @PathVariable UUID merchantId) {
        List<MemberSummaryDto> members = membershipService.listMembersForMerchant(merchantId);
        return ResponseEntity.ok(ApiResponse.success("Workspace members retrieved", members, clock));
    }

    @PostMapping("/{merchantId}/members")
    @PreAuthorize("@tenantAuth.hasAccessToMerchant(#merchantId, 'ADMIN')")
    @Operation(summary = "Add or invite a team member to the active merchant workspace (OWNER/ADMIN only)")
    public ResponseEntity<ApiResponse<MemberSummaryDto>> addMember(
            @PathVariable UUID merchantId,
            @Valid @RequestBody AddWorkspaceMemberRequest request,
            HttpServletRequest servletRequest) {
        MemberSummaryDto member = merchantWorkspaceService.addMemberToWorkspace(
                merchantId,
                request,
                servletRequest.getRemoteAddr());
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success("Workspace member added", member, clock));
    }
}
