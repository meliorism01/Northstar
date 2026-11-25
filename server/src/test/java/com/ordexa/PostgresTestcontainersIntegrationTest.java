package com.ordexa;

import static org.assertj.core.api.Assertions.assertThat;

import com.ordexa.health.dto.HealthResponse;
import com.ordexa.health.service.HealthCheckService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Full container-backed PostgreSQL 16 integration test.
 * Automatically executes when a Docker daemon is available, and cleanly marks itself
 * skipped when Docker Desktop is not installed on the build host.
 */
@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class PostgresTestcontainersIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("ordexa_integration_test")
            .withUsername("ordexa_test")
            .withPassword("ordexa_test_pwd");

    @Autowired
    private HealthCheckService healthCheckService;

    @Test
    void verifiesLivePostgreSql16ContainerAndFlywaySchema() {
        HealthResponse response = healthCheckService.checkHealth();
        assertThat(response.status()).isEqualTo("UP");
        assertThat(response.application()).isEqualTo("ORDEXA");
        assertThat(response.database()).isEqualTo("CONNECTED");
    }
}
