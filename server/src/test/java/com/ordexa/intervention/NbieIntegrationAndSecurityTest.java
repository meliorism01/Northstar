package com.ordexa.intervention;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class NbieIntegrationAndSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private record WorkspaceTokens(String ownerToken, String viewerToken, String operatorToken) {}

    private WorkspaceTokens setupWorkspaceWithRoles(String suffix) throws Exception {
        String ownerEmail = "nbie.owner." + suffix + "." + UUID.randomUUID().toString().substring(0, 6) + "@northstar.test";
        String viewerEmail = "nbie.viewer." + suffix + "." + UUID.randomUUID().toString().substring(0, 6) + "@northstar.test";
        String operatorEmail = "nbie.op." + suffix + "." + UUID.randomUUID().toString().substring(0, 6) + "@northstar.test";

        registerUser("NBIE Brand " + suffix, "Owner " + suffix, ownerEmail);

        JsonNode ownerLogin = login(ownerEmail);
        String ownerToken = ownerLogin.path("accessToken").asText();
        String merchantId = ownerLogin.path("activeWorkspace").path("merchantId").asText();

        // Add viewer & operator directly to Owner's merchant workspace
        mockMvc.perform(post("/api/v1/merchants/" + merchantId + "/members")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "Viewer " + suffix,
                                "email", viewerEmail,
                                "initialPassword", "Password@123!",
                                "role", "VIEWER"))))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/merchants/" + merchantId + "/members")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "Operator " + suffix,
                                "email", operatorEmail,
                                "initialPassword", "Password@123!",
                                "role", "OPERATOR"))))
                .andExpect(status().isCreated());

        // Set minHoursBetweenContacts=0 in test workspace so evaluation is deterministic regardless of IST clock hour
        var testPolicy = new com.ordexa.intervention.dto.InterventionDtos.UpdateInterventionPolicyRequest(
                true, true, true, true, false, false,
                new BigDecimal("2500.00"), BigDecimal.ZERO,
                List.of("VOICE_SANDBOX"), 3, 3, 0, 24, 60, true);
        mockMvc.perform(put("/api/v1/interventions/policy")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(testPolicy)))
                .andExpect(status().isOk());

        String viewerToken = switchWorkspace(login(viewerEmail).path("accessToken").asText(), merchantId);
        String operatorToken = switchWorkspace(login(operatorEmail).path("accessToken").asText(), merchantId);

        return new WorkspaceTokens(ownerToken, viewerToken, operatorToken);
    }

    private void registerUser(String businessName, String ownerName, String email) throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "businessName", businessName,
                                "ownerName", ownerName,
                                "email", email,
                                "password", "Password@123!"))))
                .andExpect(status().isCreated());
    }

    private JsonNode login(String email) throws Exception {
        MvcResult res = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", email,
                                "password", "Password@123!"))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString()).path("data");
    }

    private String switchWorkspace(String token, String merchantId) throws Exception {
        MvcResult res = mockMvc.perform(post("/api/v1/auth/select-workspace")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("merchantId", merchantId))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString())
                .path("data").path("accessToken").asText();
    }

    private JsonNode createOrder(
            String token,
            String orderNumber,
            String phone,
            String paymentMethod,
            String amount,
            String address) throws Exception {
        Map<String, Object> body = Map.of(
                "orderNumber", orderNumber,
                "source", "MANUAL",
                "customerName", "Fixture Buyer " + orderNumber,
                "customerPhone", phone,
                "paymentMethod", paymentMethod,
                "currency", "INR",
                "shippingAddress", address,
                "items", List.of(Map.of(
                        "productName", "Kumkumadi Serum",
                        "sku", "NS-SERUM-01",
                        "quantity", 1,
                        "unitPrice", new BigDecimal(amount))));

        MvcResult res = mockMvc.perform(post("/api/v1/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andReturn();

        return objectMapper.readTree(res.getResponse().getContentAsString()).path("data").path("order");
    }

    private JsonNode fetchOrder(String token, String orderUuid) throws Exception {
        MvcResult res = mockMvc.perform(get("/api/v1/orders/" + orderUuid)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString()).path("data");
    }

    @Test
    void fullLifecycleApproveRejectExecuteOutcomeNeverMutateOrderAndEnforceConsentAndSandbox() throws Exception {
        WorkspaceTokens tokens = setupWorkspaceWithRoles("lifecycle");
        String rawAddress = "Flat 402, Palm Grove Apartments, MG Road, Bengaluru 560001";
        String rawPhone = "9811223344";

        JsonNode order = createOrder(
                tokens.ownerToken(), "ORD-NBIE-101", rawPhone, "COD", "1899.00", rawAddress);
        String orderUuid = order.path("id").asText();
        String customerId = order.path("customerId").asText();

        // 1. Default evaluation BEFORE consent is granted -> contact suppressed, HUMAN_REVIEW fallback
        MvcResult initialEvalRes = mockMvc.perform(post("/api/v1/interventions/orders/" + orderUuid + "/evaluate")
                        .header("Authorization", "Bearer " + tokens.operatorToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.evaluationStatus").value("COMPLETED"))
                .andExpect(jsonPath("$.data.primaryRecommendation.type").value("HUMAN_REVIEW"))
                .andReturn();

        JsonNode initialEval = objectMapper.readTree(initialEvalRes.getResponse().getContentAsString()).path("data");
        String initialRecId = initialEval.path("recommendationId").asText();
        String initialReviewItemId = initialEval.path("primaryRecommendation").path("itemId").asText();

        // Verify raw PII is NOT stored in evidenceSnapshot
        String snapshotJson = initialEval.path("evidenceSnapshot").toString();
        assertThat(snapshotJson).doesNotContain(rawPhone);
        assertThat(snapshotJson).doesNotContain("Palm Grove Apartments");

        // 2. Rejecting HUMAN_REVIEW action must NOT cancel, decline, or mutate order status!
        mockMvc.perform(post("/api/v1/interventions/items/" + initialReviewItemId + "/reject")
                        .header("Authorization", "Bearer " + tokens.operatorToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("note", "Will verify consent first"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.recommendation.status").value("ACTION_REJECTED"));

        JsonNode orderAfterReject = fetchOrder(tokens.ownerToken(), orderUuid);
        assertThat(orderAfterReject.path("order").path("orderStatus").asText()).isEqualTo("CREATED");
        assertThat(orderAfterReject.path("order").path("paymentStatus").asText()).isEqualTo("PENDING");
        assertThat(orderAfterReject.path("statusHistory")).hasSize(1);

        // 3. Grant verified customer consent -> re-evaluate -> COD_CONFIRMATION + ADDRESS_CLARIFICATION
        mockMvc.perform(put("/api/v1/interventions/customers/" + customerId + "/consent")
                        .header("Authorization", "Bearer " + tokens.operatorToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "consentStatus", "GRANTED",
                                "permittedChannels", List.of("VOICE_SANDBOX"),
                                "consentSource", "CHECKOUT_OPT_IN"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.effectiveConsentStatus").value("GRANTED"));

        MvcResult refreshedRes = mockMvc.perform(post("/api/v1/interventions/recommendations/" + initialRecId + "/refresh")
                        .header("Authorization", "Bearer " + tokens.operatorToken()))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode refreshedRec = objectMapper.readTree(refreshedRes.getResponse().getContentAsString())
                .path("data").path("recommendation");
        String activeItemId = refreshedRec.path("primaryRecommendation").path("itemId").asText();
        assertThat(refreshedRec.path("primaryRecommendation").path("type").asText())
                .isIn("COD_CONFIRMATION", "ADDRESS_CLARIFICATION");

        // 4. Attempting execution BEFORE action approval is strictly rejected (422)
        mockMvc.perform(post("/api/v1/interventions/items/" + activeItemId + "/execute")
                        .header("Authorization", "Bearer " + tokens.operatorToken()))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errorCode").value("INTERVENTION_ACTION_NOT_ALLOWED"));

        // 5. Approve action -> authorizes intervention ONLY, order remains CREATED!
        mockMvc.perform(post("/api/v1/interventions/items/" + activeItemId + "/approve")
                        .header("Authorization", "Bearer " + tokens.operatorToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("note", "Authorize sandbox outreach"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.recommendation.primaryRecommendation.status").value("ACTION_APPROVED"));

        JsonNode orderAfterApprove = fetchOrder(tokens.ownerToken(), orderUuid);
        assertThat(orderAfterApprove.path("order").path("orderStatus").asText()).isEqualTo("CREATED");
        assertThat(orderAfterApprove.path("statusHistory")).hasSize(1);

        // 6. Revoke consent AFTER approval -> runtime execution re-check MUST block execution!
        mockMvc.perform(put("/api/v1/interventions/customers/" + customerId + "/consent")
                        .header("Authorization", "Bearer " + tokens.operatorToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "consentStatus", "DENIED",
                                "permittedChannels", List.of(),
                                "consentSource", "CUSTOMER_REVOKED"))))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/interventions/items/" + activeItemId + "/execute")
                        .header("Authorization", "Bearer " + tokens.operatorToken()))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errorCode").value("CONSENT_REQUIRED"));

        // 7. Restore GRANTED consent -> sandbox execution succeeds & transitions to OUTCOME_PENDING (not COMPLETED)
        mockMvc.perform(put("/api/v1/interventions/customers/" + customerId + "/consent")
                        .header("Authorization", "Bearer " + tokens.operatorToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "consentStatus", "GRANTED",
                                "permittedChannels", List.of("VOICE_SANDBOX"),
                                "consentSource", "CUSTOMER_REOPT_IN"))))
                .andExpect(status().isOk());

        MvcResult execRes = mockMvc.perform(post("/api/v1/interventions/items/" + activeItemId + "/execute")
                        .header("Authorization", "Bearer " + tokens.operatorToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("idempotencyKey", "exec-key-01"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.recommendation.primaryRecommendation.status").value("OUTCOME_PENDING"))
                .andExpect(jsonPath("$.data.executions[0].providerMode").value("SANDBOX"))
                .andReturn();

        // Idempotent replay produces no extra execution record
        JsonNode afterFirstExec = objectMapper.readTree(execRes.getResponse().getContentAsString()).path("data");
        int execCountAfterFirst = afterFirstExec.path("executions").size();

        MvcResult replayExecRes = mockMvc.perform(post("/api/v1/interventions/items/" + activeItemId + "/execute")
                        .header("Authorization", "Bearer " + tokens.operatorToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("idempotencyKey", "exec-key-01"))))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(objectMapper.readTree(replayExecRes.getResponse().getContentAsString())
                .path("data").path("executions").size()).isEqualTo(execCountAfterFirst);

        // 8. Record verified outcome -> persists outcome & refreshes NBIE without mutating OrderStatus!
        mockMvc.perform(post("/api/v1/interventions/items/" + activeItemId + "/outcomes")
                        .header("Authorization", "Bearer " + tokens.operatorToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "outcomeType", "CUSTOMER_CONFIRMED_INTENT",
                                "idempotencyKey", "outcome-01",
                                "resolvedFields", List.of("cod_intent_confirmation"),
                                "triggerReEvaluation", true))))
                .andExpect(status().isOk());

        JsonNode orderAtEnd = fetchOrder(tokens.ownerToken(), orderUuid);
        assertThat(orderAtEnd.path("order").path("orderStatus").asText()).isEqualTo("CREATED");
        assertThat(orderAtEnd.path("statusHistory")).hasSize(1);
    }

    @Test
    void crossTenantIsolationAndRolePermissionsAreStrictlyEnforced() throws Exception {
        WorkspaceTokens merchantA = setupWorkspaceWithRoles("tenantA");
        WorkspaceTokens merchantB = setupWorkspaceWithRoles("tenantB");

        JsonNode orderA = createOrder(
                merchantA.ownerToken(),
                "ORD-TENANT-A1",
                "9876500011",
                "COD",
                "1299.00",
                "House 12, Near Metro Station, Indiranagar, Bengaluru 560038");
        String orderAUuid = orderA.path("id").asText();

        // Viewer in Merchant A CANNOT evaluate or mutate policy (403 Forbidden)
        mockMvc.perform(post("/api/v1/interventions/orders/" + orderAUuid + "/evaluate")
                        .header("Authorization", "Bearer " + merchantA.viewerToken()))
                .andExpect(status().isForbidden());

        var policyPayload = new com.ordexa.intervention.dto.InterventionDtos.UpdateInterventionPolicyRequest(
                true,
                true,
                true,
                true,
                false,
                false,
                new BigDecimal("2500.00"),
                BigDecimal.ZERO,
                List.of("VOICE_SANDBOX"),
                3,
                3,
                2,
                24,
                60,
                true);

        mockMvc.perform(put("/api/v1/interventions/policy")
                        .header("Authorization", "Bearer " + merchantA.operatorToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(policyPayload)))
                .andExpect(status().isForbidden());

        // Operator in Merchant A CAN evaluate
        MvcResult evalARes = mockMvc.perform(post("/api/v1/interventions/orders/" + orderAUuid + "/evaluate")
                        .header("Authorization", "Bearer " + merchantA.operatorToken()))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode recA = objectMapper.readTree(evalARes.getResponse().getContentAsString()).path("data");
        String recAId = recA.path("recommendationId").asText();
        String itemAId = recA.path("primaryRecommendation").path("itemId").asText();

        // Viewer in Merchant A CAN read queue and detail
        mockMvc.perform(get("/api/v1/interventions/queue")
                        .header("Authorization", "Bearer " + merchantA.viewerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1));

        mockMvc.perform(get("/api/v1/interventions/recommendations/" + recAId)
                        .header("Authorization", "Bearer " + merchantA.viewerToken()))
                .andExpect(status().isOk());

        // Merchant B Owner CANNOT read, evaluate, approve, reject, execute, or refresh Merchant A's records (IDOR blocked -> 404)
        mockMvc.perform(post("/api/v1/interventions/orders/" + orderAUuid + "/evaluate")
                        .header("Authorization", "Bearer " + merchantB.ownerToken()))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/interventions/recommendations/" + recAId)
                        .header("Authorization", "Bearer " + merchantB.ownerToken()))
                .andExpect(status().isNotFound());

        mockMvc.perform(post("/api/v1/interventions/items/" + itemAId + "/approve")
                        .header("Authorization", "Bearer " + merchantB.ownerToken()))
                .andExpect(status().isNotFound());

        mockMvc.perform(post("/api/v1/interventions/items/" + itemAId + "/reject")
                        .header("Authorization", "Bearer " + merchantB.ownerToken()))
                .andExpect(status().isNotFound());

        mockMvc.perform(post("/api/v1/interventions/recommendations/" + recAId + "/refresh")
                        .header("Authorization", "Bearer " + merchantB.ownerToken()))
                .andExpect(status().isNotFound());

        // Merchant B's queue does not leak Merchant A's recommendations
        mockMvc.perform(get("/api/v1/interventions/queue")
                        .header("Authorization", "Bearer " + merchantB.ownerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(0));
    }
}
