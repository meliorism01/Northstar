package com.ordexa.order.dto;

import java.util.List;

public record CsvImportSummaryDto(
        int totalRowsProcessed,
        int importedOrdersCount,
        int failedRowsCount,
        List<OrderSummaryDto> importedOrders,
        List<CsvRowErrorDto> errors
) {
}
