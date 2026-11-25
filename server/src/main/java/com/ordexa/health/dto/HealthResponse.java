package com.ordexa.health.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Operational health status of the ORDEXA application and its relational database connection")
public record HealthResponse(
        @Schema(description = "Overall service health state", example = "UP")
        String status,

        @Schema(description = "Application identifier", example = "ORDEXA")
        String application,

        @Schema(description = "Live relational database connection status", example = "CONNECTED")
        String database
) {
}
