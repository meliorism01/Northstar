package com.ordexa.tenant.context;

import com.ordexa.common.exception.ErrorCode;
import com.ordexa.common.exception.OrdexaException;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;

public final class TenantContextHolder {

    private static final ThreadLocal<TenantContext> CONTEXT = new ThreadLocal<>();

    private TenantContextHolder() {
    }

    public static void setContext(TenantContext context) {
        CONTEXT.set(context);
    }

    public static Optional<TenantContext> getContext() {
        return Optional.ofNullable(CONTEXT.get());
    }

    public static TenantContext requireAuthenticatedUser() {
        TenantContext ctx = CONTEXT.get();
        if (ctx == null || ctx.userId() == null) {
            throw new OrdexaException(
                    "Authentication is required",
                    ErrorCode.UNAUTHORIZED,
                    HttpStatus.UNAUTHORIZED);
        }
        return ctx;
    }

    public static TenantContext requireActiveWorkspace() {
        TenantContext ctx = requireAuthenticatedUser();
        if (!ctx.hasActiveWorkspace()) {
            throw new OrdexaException(
                    "An active merchant workspace must be selected before accessing workspace resources",
                    ErrorCode.WORKSPACE_NOT_SELECTED,
                    HttpStatus.FORBIDDEN);
        }
        return ctx;
    }

    public static TenantContext requireMerchantMatch(UUID targetMerchantId) {
        TenantContext ctx = requireActiveWorkspace();
        if (targetMerchantId == null || !ctx.merchantId().equals(targetMerchantId)) {
            throw new OrdexaException(
                    "Cross-tenant access denied: requested merchant does not match the active authenticated workspace",
                    ErrorCode.TENANT_ACCESS_DENIED,
                    HttpStatus.FORBIDDEN);
        }
        return ctx;
    }

    public static void clear() {
        CONTEXT.remove();
    }
}
