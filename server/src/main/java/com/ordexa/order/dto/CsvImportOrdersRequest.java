package com.ordexa.order.dto;

import jakarta.validation.constraints.NotBlank;

public record CsvImportOrdersRequest(
        @NotBlank(message = "CSV content must not be empty")
        String csvContent
) {
}
