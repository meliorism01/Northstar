package com.ordexa.customer.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record CustomerSummaryDto(
        UUID id,
        UUID merchantId,
        String fullName,
        String phoneNumber,
        String email,
        int totalOrders,
        BigDecimal totalSpent,
        OffsetDateTime firstOrderAt,
        OffsetDateTime lastOrderAt,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
