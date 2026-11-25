package com.ordexa.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ordexa.auth.security.AuthRateLimitFilter;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OrderAndCustomerManagementIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AuthRateLimitFilter authRateLimitFilter;

    @BeforeEach
    void resetRateLimiter() {
        authRateLimitFilter.resetCounters();
    }

    private record RegisteredTenant(String merchantId, String email, String accessToken) {
    }

    private RegisteredTenant registerAndLoginMerchant(String businessName, String ownerName) throws Exception {
        String email = "owner." + UUID.randomUUID().toString().substring(0, 8) + "@ordexa.in";
        MvcResult reg = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "businessName", businessName,
                                "ownerName", ownerName,
                                "email", email,
                                "password", "StrongPassword123!"
                        ))))
                .andExpect(status().isCreated())
                .andReturn();

        String merchantId = objectMapper
                .readTree(reg.getResponse().getContentAsString())
                .at("/data/workspace/merchantId")
                .asText();

        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", email,
                                "password", "StrongPassword123!"
                        ))))
                .andExpect(status().isOk())
                .andReturn();

        String token = objectMapper
                .readTree(login.getResponse().getContentAsString())
                .at("/data/accessToken")
                .asText();

        return new RegisteredTenant(merchantId, email, token);
    }

    @Test
    void createOrderCalculatesServerTotalsReusesMerchantScopedCustomerAndEnforcesUniqueOrderNumbers() throws Exception {
        RegisteredTenant tenantA = registerAndLoginMerchant("VedaGlow Botanicals", "Ananya Mehta");

        // 1. Create Order #1 with 2 items: (2 * 1099.50) + (1 * 500.00) = 2699.00; discount 100.00; shipping 50.00 -> total 2649.00
        MvcResult create1 = mockMvc.perform(post("/api/v1/orders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tenantA.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "orderNumber", "ORD-VG-101",
                                "source", "MANUAL",
                                "customerName", "Rahul Sharma",
                                "customerPhone", "+91 98114-56723",
                                "customerEmail", "rahul@example.in",
                                "paymentMethod", "COD",
                                "discount", 100.00,
                                "shippingFee", 50.00,
                                "shippingAddress", "Plot 42, Shyam Nagar, Near Metro Pillar 78, Jaipur 302019",
                                "items", List.of(
                                        Map.of("productName", "Kumkumadi Facial Oil", "sku", "VG-OIL-30", "quantity", 2, "unitPrice", 1099.50),
                                        Map.of("productName", "Rosewater Mist", "sku", "VG-MIST-100", "quantity", 1, "unitPrice", 500.00)
                                )
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.order.orderNumber").value("ORD-VG-101"))
                .andExpect(jsonPath("$.data.order.orderStatus").value("CREATED"))
                .andExpect(jsonPath("$.data.order.paymentStatus").value("PENDING"))
                .andExpect(jsonPath("$.data.order.subtotal").value(2699.00))
                .andExpect(jsonPath("$.data.order.discount").value(100.00))
                .andExpect(jsonPath("$.data.order.shippingFee").value(50.00))
                .andExpect(jsonPath("$.data.order.totalAmount").value(2649.00))
                .andExpect(jsonPath("$.data.items.length()").value(2))
                .andExpect(jsonPath("$.data.statusHistory.length()").value(1))
                .andReturn();

        JsonNode json1 = objectMapper.readTree(create1.getResponse().getContentAsString());
        String customerId1 = json1.at("/data/customer/id").asText();

        // 2. Duplicate orderNumber within same merchant is rejected with 409
        mockMvc.perform(post("/api/v1/orders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tenantA.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "orderNumber", "ord-vg-101",
                                "customerName", "Rahul Sharma",
                                "customerPhone", "9811456723",
                                "paymentMethod", "PREPAID",
                                "shippingAddress", "Plot 42, Shyam Nagar, Jaipur 302019",
                                "items", List.of(
                                        Map.of("productName", "Rosewater Mist", "sku", "VG-MIST-100", "quantity", 1, "unitPrice", 500.00)
                                )
                        ))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("DUPLICATE_ORDER_NUMBER"));

        // 3. Create Order #2 for same customer phone -> reuses customerId1 and increments totalOrders to 2
        MvcResult create2 = mockMvc.perform(post("/api/v1/orders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tenantA.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "orderNumber", "ORD-VG-102",
                                "customerName", "Rahul Sharma",
                                "customerPhone", "9811456723",
                                "paymentMethod", "UPI",
                                "shippingAddress", "Plot 42, Shyam Nagar, Jaipur 302019",
                                "items", List.of(
                                        Map.of("productName", "Saffron Cream", "sku", "VG-SAFF-50", "quantity", 1, "unitPrice", 1351.00)
                                )
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.order.paymentStatus").value("PAID"))
                .andExpect(jsonPath("$.data.customer.id").value(customerId1))
                .andExpect(jsonPath("$.data.customer.totalOrders").value(2))
                .andExpect(jsonPath("$.data.customer.totalSpent").value(4000.00))
                .andReturn();

        // 4. Customer order history endpoint returns both orders
        mockMvc.perform(get("/api/v1/customers/" + customerId1 + "/orders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tenantA.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.customer.totalOrders").value(2))
                .andExpect(jsonPath("$.data.recentOrders.length()").value(2));
    }

    @Test
    void controlledLifecycleEnforcesValidTransitionsRecordsAuditHistoryAndEnforcesSafeDeletion() throws Exception {
        RegisteredTenant tenant = registerAndLoginMerchant("KoraCraft Home", "Karan Founder");

        MvcResult created = mockMvc.perform(post("/api/v1/orders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tenant.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "orderNumber", "ORD-KC-501",
                                "customerName", "Priya Nair",
                                "customerPhone", "9845123890",
                                "paymentMethod", "COD",
                                "shippingAddress", "Flat 404, Maple Residency, Indiranagar, Bengaluru 560038",
                                "items", List.of(
                                        Map.of("productName", "Brass Urli Bowl", "sku", "KC-URLI-12", "quantity", 1, "unitPrice", 3200.00)
                                )
                        ))))
                .andExpect(status().isCreated())
                .andReturn();

        String orderId = objectMapper
                .readTree(created.getResponse().getContentAsString())
                .at("/data/order/id")
                .asText();

        // 1. Invalid jump CREATED -> DELIVERED is rejected with 422
        mockMvc.perform(post("/api/v1/orders/" + orderId + "/status")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tenant.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "newStatus", "DELIVERED",
                                "reason", "Attempting invalid shortcut"
                        ))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errorCode").value("INVALID_STATUS_TRANSITION"));

        // 2. Valid path: CREATED -> CONFIRMED -> PROCESSING
        mockMvc.perform(post("/api/v1/orders/" + orderId + "/status")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tenant.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "newStatus", "CONFIRMED",
                                "reason", "Buyer confirmed via WhatsApp"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.order.orderStatus").value("CONFIRMED"));

        mockMvc.perform(post("/api/v1/orders/" + orderId + "/status")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tenant.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "newStatus", "PROCESSING",
                                "reason", "Packed at warehouse"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.order.orderStatus").value("PROCESSING"));

        // 3. Safe deletion policy: cannot delete an order in PROCESSING status!
        mockMvc.perform(delete("/api/v1/orders/" + orderId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tenant.accessToken()))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errorCode").value("ORDER_DELETION_NOT_ALLOWED"));

        // 4. Complete delivery: PROCESSING -> SHIPPED -> DELIVERED
        mockMvc.perform(post("/api/v1/orders/" + orderId + "/status")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tenant.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "newStatus", "SHIPPED",
                                "reason", "Handed over to Delhivery"
                        ))))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/orders/" + orderId + "/status")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tenant.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "newStatus", "DELIVERED",
                                "reason", "Delivered at doorstep"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.order.orderStatus").value("DELIVERED"))
                .andExpect(jsonPath("$.data.order.paymentStatus").value("PAID"))
                .andExpect(jsonPath("$.data.statusHistory.length()").value(5));
    }

    @Test
    void csvImportValidatesHeadersAndRowErrorsAndSearchAndFiltersWorkCorrectly() throws Exception {
        RegisteredTenant tenant = registerAndLoginMerchant("ZariPulse Social", "Zari Owner");

        // 1. Missing required column header returns 400 CSV_IMPORT_INVALID
        mockMvc.perform(post("/api/v1/orders/import-csv")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tenant.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "csvContent", "orderNumber,customerName\nORD-1,Test Buyer"
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("CSV_IMPORT_INVALID"));

        // 2. Mixed CSV batch: 2 valid rows, 1 bad phone row, 1 duplicate orderNumber row
        String csv = String.join("\n",
                "orderNumber,customerName,customerPhone,customerEmail,productName,sku,quantity,unitPrice,discount,shippingFee,paymentMethod,paymentStatus,shippingAddress,customerNotes",
                "ORD-CSV-1,Meera Joshi,9829011223,meera@example.in,Saffron Oil,SKU-1,2,1000.00,100.00,50.00,COD,PENDING,\"House 18 Vaishali Nagar, Jaipur\",Urgent",
                "ORD-CSV-2,Karan Malhotra,9810455678,karan@example.in,Linen Set,SKU-2,1,1500.00,0.00,0.00,PREPAID,PAID,\"Flat 902 DLF Phase 4, Gurugram\",Fragile",
                "ORD-CSV-BADPHONE,Bad Phone Buyer,123,bad@example.in,Linen Set,SKU-2,1,1500.00,0.00,0.00,COD,PENDING,\"Some Street Address, Delhi\",None",
                "ORD-CSV-1,Duplicate Order Num,9899001122,dup@example.in,Linen Set,SKU-2,1,1500.00,0.00,0.00,COD,PENDING,\"Some Street Address, Delhi\",None"
        );

        mockMvc.perform(post("/api/v1/orders/import-csv")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tenant.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("csvContent", csv))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalRowsProcessed").value(4))
                .andExpect(jsonPath("$.data.importedOrdersCount").value(2))
                .andExpect(jsonPath("$.data.failedRowsCount").value(2))
                .andExpect(jsonPath("$.data.errors.length()").value(2));

        // 3. Search by customer name ("Meera") & filter by paymentStatus ("PAID")
        mockMvc.perform(get("/api/v1/orders")
                        .param("search", "Meera")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tenant.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.items[0].orderNumber").value("ORD-CSV-1"));

        mockMvc.perform(get("/api/v1/orders")
                        .param("paymentStatus", "PAID")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tenant.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.items[0].orderNumber").value("ORD-CSV-2"));
    }

    @Test
    void multiTenantIsolationAndRbacPreventCrossMerchantOrderOrCustomerAccess() throws Exception {
        RegisteredTenant merchantA = registerAndLoginMerchant("Merchant Alpha Orders", "Alpha Owner");
        RegisteredTenant merchantB = registerAndLoginMerchant("Merchant Beta Orders", "Beta Owner");

        // Create an order in Merchant B with phone 9811456723 and orderNumber ORD-SHARED-01
        MvcResult orderBResult = mockMvc.perform(post("/api/v1/orders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + merchantB.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "orderNumber", "ORD-SHARED-01",
                                "customerName", "Beta Customer",
                                "customerPhone", "9811456723",
                                "paymentMethod", "COD",
                                "shippingAddress", "Beta Street 101, Mumbai 400001",
                                "items", List.of(
                                        Map.of("productName", "Beta Item", "sku", "BETA-1", "quantity", 1, "unitPrice", 1999.00)
                                )
                        ))))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode orderBJson = objectMapper.readTree(orderBResult.getResponse().getContentAsString());
        String orderBId = orderBJson.at("/data/order/id").asText();
        String customerBId = orderBJson.at("/data/customer/id").asText();

        // Merchant A can create an order with the EXACT SAME orderNumber and phoneNumber because both are merchant-scoped!
        mockMvc.perform(post("/api/v1/orders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + merchantA.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "orderNumber", "ORD-SHARED-01",
                                "customerName", "Alpha Customer",
                                "customerPhone", "9811456723",
                                "paymentMethod", "PREPAID",
                                "shippingAddress", "Alpha Road 202, Pune 411045",
                                "items", List.of(
                                        Map.of("productName", "Alpha Item", "sku", "ALPHA-1", "quantity", 1, "unitPrice", 999.00)
                                )
                        ))))
                .andExpect(status().isCreated());

        // Cross-tenant attempts: Merchant A cannot view, patch, transition, or delete Merchant B's order or customer
        mockMvc.perform(get("/api/v1/orders/" + orderBId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + merchantA.accessToken()))
                .andExpect(status().isNotFound());

        mockMvc.perform(patch("/api/v1/orders/" + orderBId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + merchantA.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("shippingAddress", "Hijacked Address"))))
                .andExpect(status().isNotFound());

        mockMvc.perform(post("/api/v1/orders/" + orderBId + "/status")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + merchantA.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("newStatus", "CANCELLED"))))
                .andExpect(status().isNotFound());

        mockMvc.perform(delete("/api/v1/orders/" + orderBId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + merchantA.accessToken()))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/customers/" + customerBId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + merchantA.accessToken()))
                .andExpect(status().isNotFound());

        // RBAC Test: Add a VIEWER to Merchant A and verify VIEWER can read orders but cannot create/transition/delete
        String viewerEmail = "viewer." + UUID.randomUUID().toString().substring(0, 6) + "@merchanta.in";
        mockMvc.perform(post("/api/v1/merchants/" + merchantA.merchantId() + "/members")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + merchantA.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "Alpha Viewer",
                                "email", viewerEmail,
                                "initialPassword", "StrongPassword123!",
                                "role", "VIEWER"
                        ))))
                .andExpect(status().isCreated());

        MvcResult viewerLogin = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", viewerEmail,
                                "password", "StrongPassword123!"
                        ))))
                .andExpect(status().isOk())
                .andReturn();
        String viewerToken = objectMapper
                .readTree(viewerLogin.getResponse().getContentAsString())
                .at("/data/accessToken")
                .asText();

        // VIEWER can list orders
        mockMvc.perform(get("/api/v1/orders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + viewerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1));

        // VIEWER cannot create orders -> 403 ACCESS_DENIED
        mockMvc.perform(post("/api/v1/orders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + viewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "customerName", "Unauthorized",
                                "customerPhone", "9811456723",
                                "paymentMethod", "COD",
                                "shippingAddress", "Some Valid Address 123",
                                "items", List.of(
                                        Map.of("productName", "Item", "sku", "SKU", "quantity", 1, "unitPrice", 100.00)
                                )
                        ))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("ACCESS_DENIED"));
    }
}
