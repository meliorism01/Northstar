package com.ordexa.order.dto;

import com.ordexa.customer.dto.CustomerSummaryDto;
import java.util.List;

public record OrderDetailDto(
        OrderSummaryDto order,
        CustomerSummaryDto customer,
        List<OrderItemDto> items,
        List<OrderStatusHistoryDto> statusHistory
) {
}
