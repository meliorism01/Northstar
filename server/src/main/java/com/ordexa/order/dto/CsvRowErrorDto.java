package com.ordexa.order.dto;

public record CsvRowErrorDto(
        int rowNumber,
        String orderNumber,
        String errorMessage
) {
}
