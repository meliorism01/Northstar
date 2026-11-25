package com.ordexa.order.dto;

import com.ordexa.order.entity.PaymentStatus;
import jakarta.validation.constraints.Size;

public record UpdateOrderRequest(
        PaymentStatus paymentStatus,

        @Size(min = 5, max = 1024, message = "Shipping address must be between 5 and 1024 characters")
        String shippingAddress,

        @Size(max = 1024, message = "Billing address must not exceed 1024 characters")
        String billingAddress,

        @Size(max = 1024, message = "Customer notes must not exceed 1024 characters")
        String customerNotes
) {
}
