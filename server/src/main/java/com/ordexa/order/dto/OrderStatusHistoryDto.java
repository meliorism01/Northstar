package com.ordexa.order.dto;

import com.ordexa.order.entity.OrderStatus;
import java.time.OffsetDateTime;
import java.util.UUID;

public record OrderStatusHistoryDto(
        UUID id,
        OrderStatus previousStatus,
        OrderStatus newStatus,
        String changedBy,
        String reason,
        OffsetDateTime createdAt
) {
}
