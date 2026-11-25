package com.ordexa.order.dto;

import com.ordexa.order.entity.OrderSource;
import com.ordexa.order.entity.PaymentMethod;
import com.ordexa.order.entity.PaymentStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

public record CreateOrderRequest(
        @Size(max = 64, message = "Order number must not exceed 64 characters")
        String orderNumber,

        OrderSource source,

        @NotBlank(message = "Customer full name is required")
        @Size(min = 2, max = 160, message = "Customer name must be between 2 and 160 characters")
        String customerName,

        @NotBlank(message = "Customer phone number is required")
        @Size(min = 10, max = 32, message = "Phone number must be between 10 and 32 characters")
        String customerPhone,

        @Email(message = "Customer email must be a valid email address")
        @Size(max = 255)
        String customerEmail,

        @NotNull(message = "Payment method is required")
        PaymentMethod paymentMethod,

        PaymentStatus paymentStatus,

        @DecimalMin(value = "0.00", inclusive = true, message = "Discount must not be negative")
        BigDecimal discount,

        @DecimalMin(value = "0.00", inclusive = true, message = "Shipping fee must not be negative")
        BigDecimal shippingFee,

        @Size(max = 8)
        String currency,

        @NotBlank(message = "Shipping address is required")
        @Size(min = 5, max = 1024, message = "Shipping address must be between 5 and 1024 characters")
        String shippingAddress,

        @Size(max = 1024)
        String billingAddress,

        @Size(max = 1024)
        String customerNotes,

        @NotEmpty(message = "Order must contain at least one item")
        @Valid
        List<OrderItemRequest> items
) {
}
