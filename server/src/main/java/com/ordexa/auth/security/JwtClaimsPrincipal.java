package com.ordexa.auth.security;

import com.ordexa.membership.entity.MerchantRole;
import java.util.UUID;

public record JwtClaimsPrincipal(
        UUID userId,
        String email,
        String fullName,
        UUID sessionId,
        UUID activeMerchantId,
        MerchantRole role
) {
}
