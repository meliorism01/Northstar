package com.ordexa.order.dto;

import com.ordexa.order.entity.OrderSource;
import com.ordexa.order.entity.OrderStatus;
import com.ordexa.order.entity.PaymentMethod;
import com.ordexa.order.entity.PaymentStatus;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public record OrderSummaryDto(
        UUID id,
        UUID merchantId,
        String orderNumber,
        UUID customerId,
        String customerName,
        String customerPhone,
        String customerEmail,
        OrderSource source,
        OrderStatus orderStatus,
        PaymentStatus paymentStatus,
        PaymentMethod paymentMethod,
        BigDecimal subtotal,
        BigDecimal discount,
        BigDecimal shippingFee,
        BigDecimal totalAmount,
        String currency,
        String shippingAddress,
        String billingAddress,
        String customerNotes,
        int itemCount,
        String primaryProductSummary,
        Set<OrderStatus> allowedNextStatuses,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        List<OrderItemDto> items
) {
}
