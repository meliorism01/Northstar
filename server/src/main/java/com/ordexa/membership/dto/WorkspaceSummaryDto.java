package com.ordexa.membership.dto;

import com.ordexa.membership.entity.MerchantRole;
import java.util.UUID;

public record WorkspaceSummaryDto(
        UUID merchantId,
        String businessName,
        String businessSlug,
        MerchantRole role,
        String status
) {
}
