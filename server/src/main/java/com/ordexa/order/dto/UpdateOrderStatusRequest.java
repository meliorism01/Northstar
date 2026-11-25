package com.ordexa.order.dto;

import com.ordexa.order.entity.OrderStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateOrderStatusRequest(
        @NotNull(message = "Target order status is required")
        OrderStatus newStatus,

        @Size(max = 512, message = "Reason must not exceed 512 characters")
        String reason
) {
}
