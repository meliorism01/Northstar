package com.ordexa.customer.intelligence;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ordexa.auth.dto.LoginRequest;
import com.ordexa.auth.dto.RegisterRequest;
import com.ordexa.order.dto.CreateOrderRequest;
import com.ordexa.order.dto.OrderItemRequest;
import com.ordexa.order.dto.UpdateOrderStatusRequest;
import com.ordexa.order.entity.OrderSource;
import com.ordexa.order.entity.OrderStatus;
import com.ordexa.order.entity.PaymentMethod;
import com.ordexa.order.entity.PaymentStatus;
import java.math.BigDecimal;
import java.util.List;
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
class CustomerIntelligenceIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private record TenantSession(String accessToken, UUID merchantId) {
    }

    private TenantSession registerAndLogin(String slugSuffix) throws Exception {
        String email = "intel." + slugSuffix + "." + System.nanoTime() + "@ordexa.app";
        RegisterRequest registerRequest = new RegisterRequest(
                "Intel Brand " + slugSuffix,
                "Founder " + slugSuffix,
                email,
                "Password@123!");

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest)))
                .andExpect(status().isCreated());

        LoginRequest loginRequest = new LoginRequest(email, "Password@123!");
        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode root = objectMapper.readTree(loginResult.getResponse().getContentAsString());
        String token = root.path("data").path("accessToken").asText();
        UUID merchantId = UUID.fromString(
                root.path("data").path("activeWorkspace").path("merchantId").asText());
        return new TenantSession(token, merchantId);
    }

    private JsonNode createOrder(
            String token,
            String orderNumber,
            String customerName,
            String customerPhone,
            PaymentMethod paymentMethod,
            List<OrderItemRequest> items) throws Exception {
        CreateOrderRequest req = new CreateOrderRequest(
                orderNumber,
                OrderSource.SHOPIFY,
                customerName,
                customerPhone,
                customerName.toLowerCase().replace(" ", ".") + "@example.in",
                paymentMethod,
                paymentMethod == PaymentMethod.COD ? PaymentStatus.PENDING : PaymentStatus.PAID,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                "INR",
                "24 Linking Road, Bandra West, Mumbai 400050",
                "24 Linking Road, Bandra West, Mumbai 400050",
                "Deliver during business hours",
                items);

        MvcResult res = mockMvc.perform(post("/api/v1/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString()).path("data");
    }

    private void transitionOrder(String token, UUID orderId, OrderStatus targetStatus) throws Exception {
        UpdateOrderStatusRequest req = new UpdateOrderStatusRequest(targetStatus, "Transition to " + targetStatus);
        mockMvc.perform(post("/api/v1/orders/" + orderId + "/status")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());
    }

    @Test
    void fullCustomerIntelligenceWorkflowOverviewGraphCustomer360SegmentsAndProductsWork() throws Exception {
        TenantSession tenant = registerAndLogin("alpha");

        // Customer 1 (Repeat, Loyal, High-Value, COD-Heavy): 3 orders, 2 delivered, 1 confirmed
        JsonNode ord1 = createOrder(
                tenant.accessToken(),
                "ORD-INT-101",
                "Aarav Sharma",
                "+91 9876543210",
                PaymentMethod.COD,
                List.of(
                        new OrderItemRequest("Vitamin C Face Serum", "SERUM-VITC-30", 2, new BigDecimal("1200.00")),
                        new OrderItemRequest("Barrier Repair Cream", "CREAM-BAR-50", 1, new BigDecimal("800.00"))));
        UUID ord1Id = UUID.fromString(ord1.path("order").path("id").asText());
        UUID aaravId = UUID.fromString(ord1.path("customer").path("id").asText());

        transitionOrder(tenant.accessToken(), ord1Id, OrderStatus.CONFIRMED);
        transitionOrder(tenant.accessToken(), ord1Id, OrderStatus.PROCESSING);
        transitionOrder(tenant.accessToken(), ord1Id, OrderStatus.SHIPPED);
        transitionOrder(tenant.accessToken(), ord1Id, OrderStatus.DELIVERED);

        JsonNode ord2 = createOrder(
                tenant.accessToken(),
                "ORD-INT-102",
                "Aarav Sharma",
                "9876543210",
                PaymentMethod.COD,
                List.of(
                        new OrderItemRequest("Vitamin C Face Serum", "SERUM-VITC-30", 1, new BigDecimal("1200.00")),
                        new OrderItemRequest("SPF 50 Sunscreen", "SPF-50-GEL", 2, new BigDecimal("600.00"))));
        UUID ord2Id = UUID.fromString(ord2.path("order").path("id").asText());
        transitionOrder(tenant.accessToken(), ord2Id, OrderStatus.CONFIRMED);
        transitionOrder(tenant.accessToken(), ord2Id, OrderStatus.PROCESSING);
        transitionOrder(tenant.accessToken(), ord2Id, OrderStatus.SHIPPED);
        transitionOrder(tenant.accessToken(), ord2Id, OrderStatus.DELIVERED);

        createOrder(
                tenant.accessToken(),
                "ORD-INT-103",
                "Aarav Sharma",
                "9876543210",
                PaymentMethod.COD,
                List.of(new OrderItemRequest("Vitamin C Face Serum", "SERUM-VITC-30", 1, new BigDecimal("1200.00"))));

        // Customer 2 (New Customer, shares SERUM-VITC-30 and CREAM-BAR-50 with Aarav)
        JsonNode ord4 = createOrder(
                tenant.accessToken(),
                "ORD-INT-201",
                "Meera Krishnan",
                "9811122233",
                PaymentMethod.UPI,
                List.of(
                        new OrderItemRequest("Vitamin C Face Serum", "SERUM-VITC-30", 1, new BigDecimal("1200.00")),
                        new OrderItemRequest("Barrier Repair Cream", "CREAM-BAR-50", 1, new BigDecimal("800.00"))));
        UUID meeraId = UUID.fromString(ord4.path("customer").path("id").asText());

        // 1. Verify Overview Endpoint
        mockMvc.perform(get("/api/v1/intelligence/overview")
                        .header("Authorization", "Bearer " + tenant.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.totalCustomers").value(2))
                .andExpect(jsonPath("$.data.newCustomers").value(1))
                .andExpect(jsonPath("$.data.repeatCustomers").value(1))
                .andExpect(jsonPath("$.data.loyalCustomers").value(1))
                .andExpect(jsonPath("$.data.totalOrders").value(4))
                .andExpect(jsonPath("$.data.deliveredOrders").value(2))
                .andExpect(jsonPath("$.data.distinctProductsPurchased").value(3))
                .andExpect(jsonPath("$.data.segmentDistribution", hasSize(7)));

        // 2. Verify Graph Endpoint
        mockMvc.perform(get("/api/v1/intelligence/graph")
                        .header("Authorization", "Bearer " + tenant.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.metadata.customerNodes").value(2))
                .andExpect(jsonPath("$.data.metadata.orderNodes").value(4))
                .andExpect(jsonPath("$.data.metadata.productNodes").value(3))
                .andExpect(jsonPath("$.data.edges[*].type", hasItem("PLACED")))
                .andExpect(jsonPath("$.data.edges[*].type", hasItem("CONTAINS")))
                .andExpect(jsonPath("$.data.edges[*].type", hasItem("BELONGS_TO")))
                .andExpect(jsonPath("$.data.edges[*].type", hasItem("REPEATEDLY_PURCHASED")))
                .andExpect(jsonPath("$.data.edges[*].type", hasItem("RELATED_TO")));

        // 3. Verify Customer Intelligence Directory & Filtering
        mockMvc.perform(get("/api/v1/intelligence/customers")
                        .param("segment", "LOYAL_CUSTOMER")
                        .header("Authorization", "Bearer " + tenant.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.items[0].fullName").value("Aarav Sharma"))
                .andExpect(jsonPath("$.data.items[0].purchaseMetrics.totalOrders").value(3))
                .andExpect(jsonPath("$.data.items[0].purchaseMetrics.totalSpend").value(6800.00));

        // 4. Verify Customer 360 Endpoint
        mockMvc.perform(get("/api/v1/intelligence/customers/" + aaravId)
                        .header("Authorization", "Bearer " + tenant.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.profile.fullName").value("Aarav Sharma"))
                .andExpect(jsonPath("$.data.profile.segmentIds", hasItem("REPEAT_CUSTOMER")))
                .andExpect(jsonPath("$.data.profile.segmentIds", hasItem("LOYAL_CUSTOMER")))
                .andExpect(jsonPath("$.data.profile.segmentIds", hasItem("COD_HEAVY_CUSTOMER")))
                .andExpect(jsonPath("$.data.productPreferences", hasSize(3)))
                .andExpect(jsonPath("$.data.timeline", hasSize(greaterThanOrEqualTo(11))))
                .andExpect(jsonPath("$.data.relationships.sharedProductCustomersCount").value(1))
                .andExpect(jsonPath("$.data.relationships.sharedProductCustomers[0].customerId").value(meeraId.toString()));

        // 5. Verify Individual Customer Graph, Segments, Timeline, and Products Sub-Endpoints
        mockMvc.perform(get("/api/v1/intelligence/customers/" + aaravId + "/graph")
                        .header("Authorization", "Bearer " + tenant.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.metadata.customerNodes").value(1))
                .andExpect(jsonPath("$.data.metadata.orderNodes").value(3))
                .andExpect(jsonPath("$.data.metadata.productNodes").value(3))
                .andExpect(jsonPath("$.data.nodes[?(@.id == 'customer:" + meeraId + "')]").isEmpty())
                .andExpect(jsonPath("$.data.edges[*].type", hasItem("PLACED")))
                .andExpect(jsonPath("$.data.edges[*].type", hasItem("CONTAINS")))
                .andExpect(jsonPath("$.data.edges[*].type", hasItem("BELONGS_TO")));

        mockMvc.perform(get("/api/v1/intelligence/customers/" + aaravId + "/segments")
                        .header("Authorization", "Bearer " + tenant.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(3))));

        mockMvc.perform(get("/api/v1/intelligence/customers/" + aaravId + "/timeline")
                        .header("Authorization", "Bearer " + tenant.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(11))));

        mockMvc.perform(get("/api/v1/intelligence/customers/" + aaravId + "/products")
                        .header("Authorization", "Bearer " + tenant.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(3)));

        // 6. Verify Segment Endpoints
        mockMvc.perform(get("/api/v1/intelligence/segments/REPEAT_CUSTOMER")
                        .header("Authorization", "Bearer " + tenant.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.segmentId").value("REPEAT_CUSTOMER"))
                .andExpect(jsonPath("$.data.customerCount").value(1));

        mockMvc.perform(get("/api/v1/intelligence/segments/REPEAT_CUSTOMER/customers")
                        .header("Authorization", "Bearer " + tenant.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1));

        // 7. Verify Product Intelligence & Co-Purchase Endpoints
        mockMvc.perform(get("/api/v1/intelligence/products")
                        .header("Authorization", "Bearer " + tenant.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(3))
                .andExpect(jsonPath("$.data.items[0].sku").value("SERUM-VITC-30"))
                .andExpect(jsonPath("$.data.items[0].unitsPurchased").value(5))
                .andExpect(jsonPath("$.data.items[0].uniqueCustomers").value(2))
                .andExpect(jsonPath("$.data.items[0].repeatCustomerCount").value(1));

        mockMvc.perform(get("/api/v1/intelligence/products/SERUM-VITC-30")
                        .header("Authorization", "Bearer " + tenant.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.product.sku").value("SERUM-VITC-30"))
                .andExpect(jsonPath("$.data.buyers", hasSize(2)))
                .andExpect(jsonPath("$.data.coPurchasedProducts", hasSize(2)));

        mockMvc.perform(get("/api/v1/intelligence/products/co-purchases")
                        .header("Authorization", "Bearer " + tenant.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(3)))
                .andExpect(jsonPath("$.data[0].coPurchaseOrderCount").value(2));
    }

    @Test
    void multiTenantIsolationPreventsCrossMerchantAccessAcrossAllIntelligenceEndpoints() throws Exception {
        TenantSession merchantA = registerAndLogin("isoA");
        TenantSession merchantB = registerAndLogin("isoB");

        String sharedPhone = "9844455566";

        JsonNode ordA = createOrder(
                merchantA.accessToken(),
                "ORD-ISO-A1",
                "Shared Buyer In A",
                sharedPhone,
                PaymentMethod.PREPAID,
                List.of(new OrderItemRequest("Merchant A Exclusive Product", "SKU-ONLY-A", 2, new BigDecimal("1500.00"))));
        UUID customerAId = UUID.fromString(ordA.path("customer").path("id").asText());

        JsonNode ordB = createOrder(
                merchantB.accessToken(),
                "ORD-ISO-B1",
                "Shared Buyer In B",
                sharedPhone,
                PaymentMethod.COD,
                List.of(new OrderItemRequest("Merchant B Exclusive Product", "SKU-ONLY-B", 1, new BigDecimal("999.00"))));
        UUID customerBId = UUID.fromString(ordB.path("customer").path("id").asText());

        // 1. Merchant A cannot retrieve Merchant B's Customer 360, customer graph, timeline, segments, or products
        mockMvc.perform(get("/api/v1/intelligence/customers/" + customerBId)
                        .header("Authorization", "Bearer " + merchantA.accessToken()))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/intelligence/customers/" + customerBId + "/graph")
                        .header("Authorization", "Bearer " + merchantA.accessToken()))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/intelligence/customers/" + customerBId + "/timeline")
                        .header("Authorization", "Bearer " + merchantA.accessToken()))
                .andExpect(status().isNotFound());

        // 2. Merchant A cannot retrieve Merchant B's customer graph
        mockMvc.perform(get("/api/v1/intelligence/graph")
                        .param("customerId", customerBId.toString())
                        .header("Authorization", "Bearer " + merchantA.accessToken()))
                .andExpect(status().isNotFound());

        // 3. Merchant A's full graph never contains Merchant B's nodes
        mockMvc.perform(get("/api/v1/intelligence/graph")
                        .header("Authorization", "Bearer " + merchantA.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.metadata.customerNodes").value(1))
                .andExpect(jsonPath("$.data.nodes[?(@.id == 'customer:" + customerBId + "')]").isEmpty())
                .andExpect(jsonPath("$.data.nodes[?(@.id == 'product:SKU-ONLY-B')]").isEmpty());

        // 4. Merchant A cannot inspect Merchant B's product insights
        mockMvc.perform(get("/api/v1/intelligence/products/SKU-ONLY-B")
                        .header("Authorization", "Bearer " + merchantA.accessToken()))
                .andExpect(status().isNotFound());

        // 5. Merchant B's segment customers only contain Merchant B's customer (with same phone number isolated)
        mockMvc.perform(get("/api/v1/intelligence/segments/NEW_CUSTOMER/customers")
                        .header("Authorization", "Bearer " + merchantB.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.items[0].customerId", is(customerBId.toString())))
                .andExpect(jsonPath("$.data.items[0].purchaseMetrics.totalSpend").value(999.00));

        // And Merchant A's Customer 360 has its own isolated spend (3000.00)
        mockMvc.perform(get("/api/v1/intelligence/customers/" + customerAId)
                        .header("Authorization", "Bearer " + merchantA.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.profile.purchaseMetrics.totalSpend").value(3000.00));
    }
}
