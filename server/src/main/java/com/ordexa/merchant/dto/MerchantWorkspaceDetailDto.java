package com.ordexa.merchant.dto;

import com.ordexa.membership.entity.MerchantRole;
import com.ordexa.merchant.entity.MerchantStatus;
import java.time.OffsetDateTime;
import java.util.UUID;

public record MerchantWorkspaceDetailDto(
        UUID merchantId,
        String businessName,
        String businessSlug,
        MerchantStatus status,
        MerchantRole currentUserRole,
        int activeMemberCount,
        OffsetDateTime createdAt
) {
}
