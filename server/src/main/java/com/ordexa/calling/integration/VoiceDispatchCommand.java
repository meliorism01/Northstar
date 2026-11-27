package com.ordexa.calling.integration;

import java.math.BigDecimal;
import java.util.UUID;

public record VoiceDispatchCommand(
        UUID merchantId,
        String merchantName,
        UUID callSessionId,
        UUID callAttemptId,
        int attemptNumber,
        String idempotencyKey,
        UUID orderId,
        String orderNumber,
        UUID customerId,
        String customerName,
        String phoneNumber,
        String language,
        String productSummary,
        int totalUnitCount,
        BigDecimal totalAmount,
        String currency,
        String shippingAddress,
        String callbackWebhookUrl
) {}
