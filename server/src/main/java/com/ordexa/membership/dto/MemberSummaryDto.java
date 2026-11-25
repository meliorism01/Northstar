package com.ordexa.membership.dto;

import com.ordexa.membership.entity.MembershipStatus;
import com.ordexa.membership.entity.MerchantRole;
import java.time.OffsetDateTime;
import java.util.UUID;

public record MemberSummaryDto(
        UUID membershipId,
        UUID userId,
        String fullName,
        String email,
        MerchantRole role,
        MembershipStatus status,
        OffsetDateTime joinedAt
) {
}
