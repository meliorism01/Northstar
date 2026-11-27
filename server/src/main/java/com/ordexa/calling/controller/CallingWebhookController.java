package com.ordexa.calling.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ordexa.calling.dto.CallingDtos.ProviderWebhookPayload;
import com.ordexa.calling.integration.WebhookSignatureVerifier;
import com.ordexa.calling.service.CallingWorkflowService;
import com.ordexa.common.exception.ErrorCode;
import com.ordexa.common.exception.OrdexaException;
import com.ordexa.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.time.Clock;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Authenticated webhook receiver for the AI Voice Service / telephony provider.
 * Verifies HMAC-SHA256 signatures over the exact raw request body before
 * deserializing or mutating any database state.
 */
@RestController
@RequestMapping("/api/v1/calling/webhooks")
@Tag(name = "Calling Webhooks", description = "HMAC-SHA256 authenticated voice provider callbacks")
public class CallingWebhookController {

    private final WebhookSignatureVerifier signatureVerifier;
    private final CallingWorkflowService callingService;
    private final ObjectMapper objectMapper;
    private final Validator validator;
    private final Clock clock;

    public CallingWebhookController(
            WebhookSignatureVerifier signatureVerifier,
            CallingWorkflowService callingService,
            ObjectMapper objectMapper,
            Validator validator,
            Clock clock) {
        this.signatureVerifier = signatureVerifier;
        this.callingService = callingService;
        this.objectMapper = objectMapper;
        this.validator = validator;
        this.clock = clock;
    }

    @PostMapping("/provider")
    @Operation(summary = "Receive signed call outcome & transcript webhook from the AI Voice Service")
    public ResponseEntity<ApiResponse<Map<String, Object>>> receiveProviderWebhook(
            @RequestHeader(value = "X-Northstar-Timestamp", required = false) String timestampHeader,
            @RequestHeader(value = "X-Northstar-Signature", required = false) String signatureHeader,
            @RequestBody(required = false) String rawBody) {

        if (!signatureVerifier.verify(timestampHeader, signatureHeader, rawBody)) {
            throw new OrdexaException(
                    "Invalid or expired webhook signature",
                    ErrorCode.WEBHOOK_SIGNATURE_INVALID,
                    HttpStatus.UNAUTHORIZED);
        }

        ProviderWebhookPayload payload;
        try {
            payload = objectMapper.readValue(rawBody, ProviderWebhookPayload.class);
        } catch (Exception ex) {
            throw new OrdexaException(
                    "Malformed webhook JSON payload",
                    ErrorCode.MALFORMED_REQUEST,
                    HttpStatus.BAD_REQUEST);
        }

        Set<ConstraintViolation<ProviderWebhookPayload>> violations = validator.validate(payload);
        if (!violations.isEmpty()) {
            String msg = violations.stream()
                    .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                    .collect(Collectors.joining("; "));
            throw new OrdexaException(msg, ErrorCode.VALIDATION_ERROR, HttpStatus.BAD_REQUEST);
        }

        boolean applied = callingService.processProviderWebhook(payload);
        Map<String, Object> result = Map.of(
                "eventId", payload.eventId(),
                "applied", applied,
                "idempotentReplay", !applied);

        return ResponseEntity.ok(ApiResponse.success("Webhook processed", result, clock));
    }
}
