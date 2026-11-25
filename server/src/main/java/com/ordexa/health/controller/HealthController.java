package com.ordexa.health.controller;

import com.ordexa.common.response.ApiResponse;
import com.ordexa.health.dto.HealthResponse;
import com.ordexa.health.service.HealthCheckService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Clock;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/health")
@Tag(name = "Health & Monitoring", description = "Live application and PostgreSQL connectivity verification endpoints")
public class HealthController {

    private final HealthCheckService healthCheckService;
    private final Clock clock;

    public HealthController(HealthCheckService healthCheckService, Clock clock) {
        this.healthCheckService = healthCheckService;
        this.clock = clock;
    }

    @GetMapping
    @Operation(
            summary = "Verify application and database health",
            description = "Executes a live JDBC query against PostgreSQL and reports UP/CONNECTED or DOWN/DISCONNECTED.")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "200",
                    description = "Application and database are healthy"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "503",
                    description = "Database connectivity check failed")
    })
    public ResponseEntity<HealthResponse> getHealth() {
        HealthResponse health = healthCheckService.checkHealth();
        HttpStatus status = "UP".equals(health.status())
                ? HttpStatus.OK
                : HttpStatus.SERVICE_UNAVAILABLE;
        return ResponseEntity.status(status).body(health);
    }

    @GetMapping("/envelope")
    @Operation(
            summary = "Verify health wrapped in standard ApiResponse envelope",
            description = "Returns the health payload inside the standard ORDEXA ApiResponse wrapper.")
    public ResponseEntity<ApiResponse<HealthResponse>> getHealthEnvelope() {
        HealthResponse health = healthCheckService.checkHealth();
        if ("UP".equals(health.status())) {
            return ResponseEntity.ok(ApiResponse.success("System is healthy", health, clock));
        }
        return ResponseEntity
                .status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new ApiResponse<>(
                        false,
                        "Database connection is unavailable",
                        health,
                        "DATABASE_UNAVAILABLE",
                        null,
                        java.time.LocalDateTime.now(clock).truncatedTo(java.time.temporal.ChronoUnit.SECONDS)));
    }
}
