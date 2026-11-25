package com.ordexa.tenant.security;

import com.ordexa.common.exception.ErrorCode;
import com.ordexa.common.exception.OrdexaException;
import com.ordexa.membership.entity.MembershipStatus;
import com.ordexa.membership.entity.MerchantMembership;
import com.ordexa.membership.entity.MerchantRole;
import com.ordexa.membership.repository.MerchantMembershipRepository;
import com.ordexa.merchant.entity.MerchantStatus;
import com.ordexa.tenant.context.TenantContext;
import com.ordexa.tenant.context.TenantContextHolder;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component("tenantAuth")
public class TenantAuthorizationService {

    private final MerchantMembershipRepository membershipRepository;

    public TenantAuthorizationService(MerchantMembershipRepository membershipRepository) {
        this.membershipRepository = membershipRepository;
    }

    public TenantContext verifyActiveWorkspaceRole(MerchantRole minimumRole) {
        TenantContext ctx = TenantContextHolder.requireActiveWorkspace();
        if (!ctx.role().hasAtLeast(minimumRole)) {
            throw new OrdexaException(
                    "Insufficient workspace permissions: requires at least " + minimumRole.name(),
                    ErrorCode.ACCESS_DENIED,
                    HttpStatus.FORBIDDEN);
        }
        return ctx;
    }

    public TenantContext verifyMerchantAccess(UUID targetMerchantId, MerchantRole minimumRole) {
        TenantContext ctx = TenantContextHolder.requireMerchantMatch(targetMerchantId);
        MerchantMembership membership = membershipRepository
                .findByMerchantIdAndUserIdWithDetails(targetMerchantId, ctx.userId())
                .orElseThrow(() -> new OrdexaException(
                        "No membership found for the target merchant workspace",
                        ErrorCode.TENANT_ACCESS_DENIED,
                        HttpStatus.FORBIDDEN));

        if (membership.getStatus() != MembershipStatus.ACTIVE
                || membership.getMerchant().getStatus() != MerchantStatus.ACTIVE) {
            throw new OrdexaException(
                    "Merchant workspace membership is not active",
                    ErrorCode.TENANT_ACCESS_DENIED,
                    HttpStatus.FORBIDDEN);
        }

        if (!membership.getRole().hasAtLeast(minimumRole)) {
            throw new OrdexaException(
                    "Insufficient workspace permissions: requires at least " + minimumRole.name(),
                    ErrorCode.ACCESS_DENIED,
                    HttpStatus.FORBIDDEN);
        }
        return ctx;
    }

    public boolean hasMinimumRole(String roleName) {
        MerchantRole required = MerchantRole.valueOf(roleName);
        verifyActiveWorkspaceRole(required);
        return true;
    }

    public boolean hasAccessToMerchant(UUID merchantId, String minimumRoleName) {
        MerchantRole required = MerchantRole.valueOf(minimumRoleName);
        verifyMerchantAccess(merchantId, required);
        return true;
    }
}
