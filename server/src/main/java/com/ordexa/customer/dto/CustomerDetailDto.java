package com.ordexa.customer.dto;

import com.ordexa.order.dto.OrderSummaryDto;
import java.util.List;

public record CustomerDetailDto(
        CustomerSummaryDto customer,
        List<OrderSummaryDto> recentOrders
) {
}
