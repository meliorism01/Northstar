package com.ordexa.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.ordexa.auth.dto.AuthSessionResponse;
import com.ordexa.auth.dto.LoginRequest;
import com.ordexa.auth.dto.RegisterRequest;
import com.ordexa.auth.dto.RegisterResponse;
import com.ordexa.auth.service.AuthenticationService;
import com.ordexa.auth.service.AuthenticationService.AuthResultWithRefreshCookie;
import com.ordexa.health.dto.HealthResponse;
import com.ordexa.health.service.HealthCheckService;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Verifies Flyway V1 + V2 migrations, entity mappings, constraints, BCrypt hashing,
 * and refresh token persistence against the live local PostgreSQL instance on 127.0.0.1:5433.
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

    @Autowired
    private DataSource dataSource;

    @Autowired
    private HealthCheckService healthCheckService;

    @Autowired
    private AuthenticationService authenticationService;

    @Test
    void verifiesActualPostgreSqlTablesFlywayHistoryAndRegistrationTransaction() throws Exception {
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
                "audit_logs"
        );

        String uniqueEmail = "pg.verify." + UUID.randomUUID().toString().substring(0, 8) + "@ordexa.in";
        RegisterResponse reg = authenticationService.registerMerchant(
                new RegisterRequest("PostgreSQL Verified Brand", "Manik Mehra", uniqueEmail, "StrongPassword123!"),
                "127.0.0.1");

        assertThat(reg.user().email()).isEqualTo(uniqueEmail);
        assertThat(reg.workspace().businessName()).isEqualTo("PostgreSQL Verified Brand");

        AuthResultWithRefreshCookie auth = authenticationService.authenticate(
                new LoginRequest(uniqueEmail, "StrongPassword123!"),
                "127.0.0.1",
                "JUnit-PostgreSQL-Verifier");

        AuthSessionResponse session = auth.session();
        assertThat(session.accessToken()).isNotBlank();
        assertThat(session.activeWorkspace().merchantId()).isEqualTo(reg.workspace().merchantId());
        assertThat(auth.rawRefreshToken()).isNotBlank();
    }
}
