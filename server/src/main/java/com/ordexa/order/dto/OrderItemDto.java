package com.ordexa.order.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record OrderItemDto(
        UUID id,
        String productName,
        String sku,
        int quantity,
        BigDecimal unitPrice,
        BigDecimal totalPrice
) {
}
