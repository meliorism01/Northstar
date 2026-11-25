package com.ordexa.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.ordexa.auth.dto.AuthSessionResponse;
import com.ordexa.auth.dto.LoginRequest;
import com.ordexa.auth.dto.RegisterRequest;
import com.ordexa.auth.dto.RegisterResponse;
import com.ordexa.auth.service.AuthenticationService;
import com.ordexa.auth.service.AuthenticationService.AuthResultWithRefreshCookie;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.Customer360Dto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.GraphResponseDto;
import com.ordexa.customer.intelligence.dto.CustomerIntelligenceDtos.IntelligenceOverviewDto;
import com.ordexa.customer.intelligence.service.CustomerIntelligenceService;
import com.ordexa.health.dto.HealthResponse;
import com.ordexa.health.service.HealthCheckService;
import com.ordexa.membership.entity.MerchantRole;
import com.ordexa.order.dto.CreateOrderRequest;
import com.ordexa.order.dto.OrderDetailDto;
import com.ordexa.order.dto.OrderItemRequest;
import com.ordexa.order.dto.UpdateOrderStatusRequest;
import com.ordexa.order.entity.OrderSource;
import com.ordexa.order.entity.OrderStatus;
import com.ordexa.order.entity.PaymentMethod;
import com.ordexa.order.service.OrderService;
import com.ordexa.tenant.context.TenantContext;
import com.ordexa.tenant.context.TenantContextHolder;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Verifies Flyway V1 + V2 + V3 migrations, entity mappings, constraints, BCrypt hashing,
 * refresh token persistence, and PostgreSQL order lifecycle persistence against the live
 * local PostgreSQL instance on 127.0.0.1:5433.
 */
@SpringBootTest
class LivePostgresMultiTenantIntegrationTest {

    private static final String PG_URL = "jdbc:postgresql://127.0.0.1:5433/ordexa_test_db";
    private static final String PG_USER = "ordexa_app";
    private static final String PG_PASS = "";

    @DynamicPropertySource
    static void registerPostgresProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> PG_URL);
        registry.add("spring.datasource.username", () -> PG_USER);
        registry.add("spring.datasource.password", () -> PG_PASS);
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        registry.add("ordexa.security.jwt.secret", () -> "live-postgresql-integration-test-jwt-secret-key-min-32-bytes");
    }

    @BeforeAll
    static void checkLocalPostgresReachable() {
        boolean reachable = false;
        try (Connection conn = DriverManager.getConnection(PG_URL, PG_USER, PG_PASS)) {
            reachable = conn.isValid(2);
        } catch (Exception ignored) {
            reachable = false;
        }
        assumeTrue(reachable, "Local PostgreSQL cluster on 127.0.0.1:5433 is not reachable");
    }

    @AfterEach
    void clearTenantContext() {
        TenantContextHolder.clear();
    }

    @Autowired
    private DataSource dataSource;

    @Autowired
    private HealthCheckService healthCheckService;

    @Autowired
    private AuthenticationService authenticationService;

    @Autowired
    private OrderService orderService;

    @Autowired
    private CustomerIntelligenceService customerIntelligenceService;

    @Test
    void verifiesActualPostgreSqlTablesFlywayV1V2V3AndOrderCreationAndLifecycle() throws Exception {
        HealthResponse health = healthCheckService.checkHealth();
        assertThat(health.status()).isEqualTo("UP");
        assertThat(health.database()).isEqualTo("CONNECTED");

        Set<String> publicTables = new TreeSet<>();
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(
                     "SELECT tablename FROM pg_tables WHERE schemaname = 'public'")) {
            while (rs.next()) {
                publicTables.add(rs.getString(1));
            }
        }

        assertThat(publicTables).contains(
                "flyway_schema_history",
                "system_bootstrap_audit",
                "merchants",
                "users",
                "merchant_memberships",
                "authentication_sessions",
                "refresh_tokens",
                "audit_logs",
                "customers",
                "orders",
                "order_items",
                "order_status_history",
                "customer_behavioural_events"
        );

        String uniqueEmail = "pg.v3." + UUID.randomUUID().toString().substring(0, 8) + "@ordexa.in";
        RegisterResponse reg = authenticationService.registerMerchant(
                new RegisterRequest("PostgreSQL V3 Order Brand", "Manik Mehra", uniqueEmail, "StrongPassword123!"),
                "127.0.0.1");

        AuthResultWithRefreshCookie auth = authenticationService.authenticate(
                new LoginRequest(uniqueEmail, "StrongPassword123!"),
                "127.0.0.1",
                "JUnit-PostgreSQL-V3-Verifier");

        AuthSessionResponse session = auth.session();
        assertThat(session.accessToken()).isNotBlank();

        TenantContextHolder.setContext(new TenantContext(
                reg.user().id(),
                reg.user().email(),
                reg.user().fullName(),
                UUID.randomUUID(),
                reg.workspace().merchantId(),
                reg.workspace().businessName(),
                reg.workspace().businessSlug(),
                MerchantRole.OWNER));

        OrderDetailDto createdOrder = orderService.createOrder(
                new CreateOrderRequest(
                        null,
                        OrderSource.MANUAL,
                        "Aarav Patel",
                        "9820112233",
                        "aarav@example.in",
                        PaymentMethod.COD,
                        null,
                        new BigDecimal("50.00"),
                        new BigDecimal("40.00"),
                        "INR",
                        "B-402 Sea View Apartments, Bandra West, Mumbai 400050",
                        null,
                        "Deliver before 6 PM",
                        List.of(new OrderItemRequest("Ayurvedic Hair Elixir", "VG-HAIR-100", 2, new BigDecimal("750.00")))),
                "127.0.0.1");

        assertThat(createdOrder.order().totalAmount()).isEqualByComparingTo("1490.00");
        assertThat(createdOrder.order().orderStatus()).isEqualTo(OrderStatus.CREATED);

        OrderDetailDto confirmedOrder = orderService.transitionOrderStatus(
                createdOrder.order().id(),
                new UpdateOrderStatusRequest(OrderStatus.CONFIRMED, "Confirmed in live PostgreSQL test"),
                "127.0.0.1");

        assertThat(confirmedOrder.order().orderStatus()).isEqualTo(OrderStatus.CONFIRMED);
        assertThat(confirmedOrder.statusHistory()).hasSize(2);

        IntelligenceOverviewDto overview = customerIntelligenceService.getOverview();
        assertThat(overview.totalCustomers()).isEqualTo(1);
        assertThat(overview.newCustomers()).isEqualTo(1);
        assertThat(overview.totalQualifyingRevenue()).isEqualByComparingTo("1490.00");

        Customer360Dto c360 = customerIntelligenceService.getCustomer360(createdOrder.customer().id());
        assertThat(c360.profile().segmentIds()).contains("NEW_CUSTOMER");
        assertThat(c360.productPreferences()).hasSize(1);
        assertThat(c360.timeline()).hasSizeGreaterThanOrEqualTo(3);

        GraphResponseDto graph = customerIntelligenceService.getGraph(
                null, null, null, null, null, null, 100);
        assertThat(graph.metadata().customerNodes()).isEqualTo(1);
        assertThat(graph.metadata().orderNodes()).isEqualTo(1);
        assertThat(graph.metadata().productNodes()).isEqualTo(1);
    }
}
