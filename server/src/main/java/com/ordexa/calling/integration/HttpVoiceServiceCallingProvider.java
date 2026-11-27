package com.ordexa.calling.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ordexa.calling.config.CallingProperties;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Production HTTP client for the stateless Node.js AI Voice Service
 * (LiveKit + Sarvam AI + Vobiz/Twilio SIP). Signs outbound dispatch payloads
 * with HMAC-SHA256 and enforces idempotency keys.
 *
 * IMPORTANT: If an HTTP read timeout occurs after sending the request, returns
 * {@code ambiguousTimeout=true} so the caller leaves the attempt open for
 * webhook/sweep reconciliation instead of blindly placing a duplicate PSTN call.
 */
@Component
public class HttpVoiceServiceCallingProvider implements VoiceCallingProvider {

    public static final String CODE = "VOICE_SERVICE";
    private static final Logger log = LoggerFactory.getLogger(HttpVoiceServiceCallingProvider.class);

    private final CallingProperties properties;
    private final WebhookSignatureVerifier signatureVerifier;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final HttpClient httpClient;

    public HttpVoiceServiceCallingProvider(
            CallingProperties properties,
            WebhookSignatureVerifier signatureVerifier,
            ObjectMapper objectMapper,
            Clock clock) {
        this.properties = properties;
        this.signatureVerifier = signatureVerifier;
        this.objectMapper = objectMapper;
        this.clock = clock;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(Math.min(5, properties.httpTimeoutSeconds())))
                .build();
    }

    @Override
    public String providerCode() {
        return CODE;
    }

    @Override
    public VoiceDispatchResult initiateCall(VoiceDispatchCommand command) {
        try {
            Map<String, Object> bodyMap = new LinkedHashMap<>();
            bodyMap.put("profile", "northstar-cod-verify");
            bodyMap.put("idempotencyKey", command.idempotencyKey());
            bodyMap.put("merchantId", command.merchantId().toString());
            bodyMap.put("merchantName", command.merchantName());
            bodyMap.put("callSessionId", command.callSessionId().toString());
            bodyMap.put("callAttemptId", command.callAttemptId().toString());
            bodyMap.put("attemptNumber", command.attemptNumber());
            bodyMap.put("orderId", command.orderId().toString());
            bodyMap.put("orderNumber", command.orderNumber());
            bodyMap.put("customerId", command.customerId().toString());
            bodyMap.put("phone", command.phoneNumber());
            bodyMap.put("lang", command.language());
            bodyMap.put("callbackWebhookUrl", command.callbackWebhookUrl());

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("customer_name", command.customerName());
            payload.put("order_number", command.orderNumber());
            payload.put("product_name", command.productSummary());
            payload.put("quantity", command.totalUnitCount());
            payload.put("total_amount", command.totalAmount().toPlainString());
            payload.put("currency", command.currency());
            payload.put("shipping_address", command.shippingAddress());
            payload.put("store_name", command.merchantName());
            bodyMap.put("payload", payload);

            String jsonBody = objectMapper.writeValueAsString(bodyMap);
            long ts = Instant.now(clock).getEpochSecond();
            String signature = signatureVerifier.computeSignature(ts, jsonBody);

            String endpoint = properties.voiceServiceUrl().replaceAll("/+$", "") + "/v1/calls/dispatch";
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .timeout(Duration.ofSeconds(properties.httpTimeoutSeconds()))
                    .header("Content-Type", "application/json")
                    .header("X-Idempotency-Key", command.idempotencyKey())
                    .header("X-Northstar-Timestamp", String.valueOf(ts))
                    .header("X-Northstar-Signature", signature)
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                JsonNode root = objectMapper.readTree(response.body());
                String providerCallId = root.path("providerCallId").asText(null);
                String roomName = root.path("roomName").asText(null);
                return VoiceDispatchResult.accepted(CODE, providerCallId, roomName);
            }

            log.warn(
                    "[voice-service] Dispatch rejected HTTP {} for order={}",
                    response.statusCode(),
                    command.orderNumber());
            return VoiceDispatchResult.rejected(
                    CODE, "Voice service returned HTTP " + response.statusCode());
        } catch (HttpTimeoutException timeoutEx) {
            log.warn(
                    "[voice-service] Ambiguous HTTP timeout dispatching order={} — awaiting webhook/sweep reconciliation",
                    command.orderNumber());
            return VoiceDispatchResult.ambiguousTimeout(
                    CODE, "Provider dispatch timed out; awaiting reconciliation before retry");
        } catch (Exception ex) {
            log.warn(
                    "[voice-service] Connection failure dispatching order={}: {}",
                    command.orderNumber(),
                    ex.getMessage());
            return VoiceDispatchResult.rejected(CODE, "Voice service unreachable: " + ex.getMessage());
        }
    }
}
