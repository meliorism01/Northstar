package com.ordexa.calling.events;

import java.util.UUID;

public record OrderCreatedForCallingEvent(
        UUID merchantId,
        UUID orderId
) {}
