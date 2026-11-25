package com.ordexa.tenant.context;

import com.ordexa.membership.entity.MerchantRole;
import java.util.UUID;

public record TenantContext(
        UUID userId,
        String email,
        String fullName,
        UUID sessionId,
        UUID merchantId,
        String merchantName,
        String merchantSlug,
        MerchantRole role
) {

    public boolean hasActiveWorkspace() {
        return merchantId != null && role != null;
    }
}
