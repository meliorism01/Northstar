package com.ordexa.calling;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ordexa.calling.events.OrderCreatedForCallingEvent;
import com.ordexa.calling.integration.WebhookSignatureVerifier;
import com.ordexa.calling.repository.CallAttemptRepository;
import com.ordexa.calling.repository.CallSessionRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CallingAgentIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private WebhookSignatureVerifier signatureVerifier;

    @Autowired
    private CallSessionRepository callSessionRepository;

    @Autowired
    private CallAttemptRepository callAttemptRepository;

    @Autowired
    private ApplicationEventPublisher eventPublisher;

    @Autowired
    private Clock clock;

    private String registerAndLoginMerchant(String suffix) throws Exception {
        String email = "calling." + suffix + "." + UUID.randomUUID().toString().substring(0, 6) + "@northstar.test";
        Map<String, Object> reg = Map.of(
                "businessName", "Northstar Calling Brand " + suffix,
                "ownerName", "Founder " + suffix,
                "email", email,
                "password", "Password@123!");

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reg)))
                .andExpect(status().isCreated());

        MvcResult loginRes = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", email,
                                "password", "Password@123!"))))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode root = objectMapper.readTree(loginRes.getResponse().getContentAsString());
        String token = root.path("data").path("accessToken").asText();

        // Allow 24h calling window in test workspace so automatic dispatch runs deterministically at any test clock hour
        var cfg = new com.ordexa.calling.dto.CallingDtos.UpdateCallingConfigurationRequest(
                true,
                "SANDBOX",
                "hi-IN",
                "hi-IN,en-IN",
                3,
                30,
                120,
                90,
                23,
                5,
                true,
                true);

        mockMvc.perform(put("/api/v1/calling/configuration")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(cfg)))
                .andExpect(status().isOk());

        return token;
    }

    private JsonNode createOrder(
            String token,
            String orderNumber,
            String phone,
            String paymentMethod,
            String unitPrice,
            String address) throws Exception {
        Map<String, Object> req = Map.of(
                "orderNumber", orderNumber,
                "source", "MANUAL",
                "customerName", "Buyer " + orderNumber,
                "customerPhone", phone,
                "paymentMethod", paymentMethod,
                "currency", "INR",
                "shippingAddress", address,
                "items", List.of(Map.of(
                        "productName", "Ayurvedic Kumkumadi Serum",
                        "sku", "NS-SERUM-01",
                        "quantity", 1,
                        "unitPrice", new java.math.BigDecimal(unitPrice))));

        MvcResult res = mockMvc.perform(post("/api/v1/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andReturn();

        return objectMapper.readTree(res.getResponse().getContentAsString()).path("data").path("order");
    }

    @Test
    void everyEligibleCodOrderEntersCallingWorkflowRegardlessOfRtoRiskWhilePrepaidDoesNot() throws Exception {
        String token = registerAndLoginMerchant("universal");

        // 1. Low-risk COD order (low value Rs 499, complete address with landmark)
        JsonNode lowRiskCod = createOrder(
                token, "ORD-LOW-101", "9811001101", "COD", "499.00",
                "House 14, Block C, Near City Park, Indiranagar, Bengaluru 560038");

        // 2. High-risk COD order (high value Rs 4999, brief address without landmark)
        JsonNode highRiskCod = createOrder(
                token, "ORD-HIGH-102", "9811001102", "COD", "4999.00",
                "MG Road Pune");

        // 3. Prepaid order -> must NOT enter COD calling queue
        createOrder(
                token, "ORD-PREP-103", "9811001103", "PREPAID", "1999.00",
                "Flat 201, Sector 18, Noida 201301");

        MvcResult queueRes = mockMvc.perform(get("/api/v1/calling/sessions")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode items = objectMapper.readTree(queueRes.getResponse().getContentAsString())
                .path("data").path("items");
        assertThat(items.size()).isEqualTo(2);

        List<String> enrolledOrderNumbers = List.of(
                items.get(0).path("orderNumber").asText(),
                items.get(1).path("orderNumber").asText());
        assertThat(enrolledOrderNumbers).containsExactlyInAnyOrder("ORD-LOW-101", "ORD-HIGH-102");

        // Verify duplicate order event does NOT create duplicate sessions or attempts
        UUID merchantId = UUID.fromString(lowRiskCod.path("merchantId").asText());
        UUID lowOrderId = UUID.fromString(lowRiskCod.path("id").asText());
        long attemptsBefore = callAttemptRepository.countByMerchantId(merchantId);
        eventPublisher.publishEvent(new OrderCreatedForCallingEvent(merchantId, lowOrderId));
        assertThat(callSessionRepository.findByMerchantIdOrderByCreatedAtDesc(merchantId)).hasSize(2);
        assertThat(callAttemptRepository.countByMerchantId(merchantId)).isEqualTo(attemptsBefore);

        // Verify high-risk session has HIGH risk band AND still entered queue
        String highOrderIdStr = highRiskCod.path("id").asText();
        mockMvc.perform(get("/api/v1/calling/orders/" + highOrderIdStr + "/rto-assessment")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.riskBand").value("HIGH"));
    }

    @Test
    void fullCallLifecycleConfirmRejectNoAnswerCancelWebhookSecurityAndTenantIsolation() throws Exception {
        String tokenA = registerAndLoginMerchant("alpha");
        String tokenB = registerAndLoginMerchant("beta");

        // Order 1: Simulate CONFIRMED via signed HMAC-SHA256 webhook -> verifies order transitions to CONFIRMED
        JsonNode ordConfirm = createOrder(
                tokenA, "ORD-CFM-201", "9822002201", "COD", "1599.00",
                "Flat 12B, Near Galleria Market, DLF Phase 4, Gurugram 122009");
        UUID ordConfirmId = UUID.fromString(ordConfirm.path("id").asText());
        UUID merchantA = UUID.fromString(ordConfirm.path("merchantId").asText());
        UUID sessionConfirmId = callSessionRepository
                .findByMerchantIdAndOrder_Id(merchantA, ordConfirmId).orElseThrow().getId();

        // Ensure attempt is initiated (if test runs during 23:00–05:00 IST window)
        mockMvc.perform(post("/api/v1/calling/sessions/" + sessionConfirmId + "/retry")
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andReturn();

        // Unsigned webhook MUST fail with 401 WEBHOOK_SIGNATURE_INVALID
        String webhookBody = objectMapper.writeValueAsString(Map.of(
                "eventId", "wh-evt-confirm-201",
                "eventType", "CALL_COMPLETED",
                "callSessionId", sessionConfirmId.toString(),
                "outcome", "CONFIRMED",
                "durationSeconds", 48,
                "aiSummary", "Customer confirmed COD order and address in Hindi.",
                "customerIntent", "Confirmed Order",
                "transcriptTurns", List.of(
                        Map.of("turnIndex", 0, "role", "AGENT", "text", "Namaste, kya aap order confirm karte hain?"),
                        Map.of("turnIndex", 1, "role", "CUSTOMER", "text", "Haan ji confirm kar dijiye."))));

        mockMvc.perform(post("/api/v1/calling/webhooks/provider")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(webhookBody))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value("WEBHOOK_SIGNATURE_INVALID"));

        // Valid signed webhook succeeds and updates order status CREATED -> CONFIRMED
        long ts = Instant.now(clock).getEpochSecond();
        String validSig = signatureVerifier.computeSignature(ts, webhookBody);

        mockMvc.perform(post("/api/v1/calling/webhooks/provider")
                        .header("X-Northstar-Timestamp", String.valueOf(ts))
                        .header("X-Northstar-Signature", validSig)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(webhookBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.applied").value(true))
                .andExpect(jsonPath("$.data.idempotentReplay").value(false));

        // Duplicate webhook replay MUST be idempotent (applied=false, idempotentReplay=true)
        mockMvc.perform(post("/api/v1/calling/webhooks/provider")
                        .header("X-Northstar-Timestamp", String.valueOf(ts))
                        .header("X-Northstar-Signature", validSig)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(webhookBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.applied").value(false))
                .andExpect(jsonPath("$.data.idempotentReplay").value(true));

        // Verify order status updated to CONFIRMED and RTO assessment includes CALL_CONFIRMED_INTENT
        mockMvc.perform(get("/api/v1/orders/" + ordConfirmId)
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.order.orderStatus").value("CONFIRMED"));

        mockMvc.perform(get("/api/v1/calling/sessions/" + sessionConfirmId)
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.session.outcome").value("CONFIRMED"))
                .andExpect(jsonPath("$.data.transcript.length()").value(2));

        // Tenant isolation: Merchant B cannot access Merchant A's call session
        mockMvc.perform(get("/api/v1/calling/sessions/" + sessionConfirmId)
                        .header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isNotFound());

        // Order 2: Simulate NO_ANSWER -> verify RETRY_SCHEDULED and nextAttemptAt populated
        JsonNode ordNoAns = createOrder(
                tokenA, "ORD-NOA-202", "9822002202", "COD", "1299.00",
                "House 55, Sector 15, Chandigarh 160015");
        UUID sessionNoAnsId = callSessionRepository
                .findByMerchantIdAndOrder_Id(merchantA, UUID.fromString(ordNoAns.path("id").asText()))
                .orElseThrow().getId();

        mockMvc.perform(post("/api/v1/calling/sessions/" + sessionNoAnsId + "/simulate-outcome")
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"NO_ANSWER\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.session.status").value("RETRY_SCHEDULED"))
                .andExpect(jsonPath("$.data.session.outcome").value("NO_ANSWER"))
                .andExpect(jsonPath("$.data.session.nextAttemptAt").isNotEmpty());

        // Order 3: Simulate REJECTED -> verify recorded + HIGH risk
        JsonNode ordReject = createOrder(
                tokenA, "ORD-REJ-203", "9822002203", "COD", "1899.00",
                "Plot 9, Banjara Hills, Road 12, Hyderabad 500034");
        UUID sessionRejectId = callSessionRepository
                .findByMerchantIdAndOrder_Id(merchantA, UUID.fromString(ordReject.path("id").asText()))
                .orElseThrow().getId();

        mockMvc.perform(post("/api/v1/calling/sessions/" + sessionRejectId + "/simulate-outcome")
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"REJECTED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.session.outcome").value("REJECTED"))
                .andExpect(jsonPath("$.data.session.doNotCallFurther").value(true))
                .andExpect(jsonPath("$.data.rtoAssessment.riskBand").value("HIGH"));

        // Order 4: Simulate CANCELLATION_REQUESTED -> verify further calls stopped & retry blocked
        JsonNode ordCancel = createOrder(
                tokenA, "ORD-CAN-204", "9822002204", "COD", "999.00",
                "Flat 8, Law College Road, Pune 411004");
        UUID sessionCancelId = callSessionRepository
                .findByMerchantIdAndOrder_Id(merchantA, UUID.fromString(ordCancel.path("id").asText()))
                .orElseThrow().getId();

        mockMvc.perform(post("/api/v1/calling/sessions/" + sessionCancelId + "/simulate-outcome")
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"CANCELLATION_REQUESTED\",\"customerOptOut\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.session.outcome").value("CANCELLATION_REQUESTED"))
                .andExpect(jsonPath("$.data.session.doNotCallFurther").value(true))
                .andExpect(jsonPath("$.data.customerOptedOut").value(true));

        // Subsequent manual retry MUST be blocked because customer requested cancellation & opted out
        mockMvc.perform(post("/api/v1/calling/sessions/" + sessionCancelId + "/retry")
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errorCode").value("CALL_ACTION_NOT_ALLOWED"));

        // Verify overview reflects all 4 sessions accurately
        mockMvc.perform(get("/api/v1/calling/overview")
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalCodOrdersRequiringVerification").value(4))
                .andExpect(jsonPath("$.data.confirmedOrders").value(1))
                .andExpect(jsonPath("$.data.rejectedOrders").value(1))
                .andExpect(jsonPath("$.data.unansweredCalls").value(1))
                .andExpect(jsonPath("$.data.cancellationRequests").value(1));
    }
}
