package com.ordexa;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ordexa.health.entity.SystemBootstrapRecord;
import com.ordexa.health.repository.SystemBootstrapRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OrdexaFoundationIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SystemBootstrapRepository systemBootstrapRepository;

    @Test
    void flywayMigrationAndJpaSchemaValidationSucceedOnStartup() {
        Optional<SystemBootstrapRecord> record =
                systemBootstrapRepository.findByComponentCode("ORDEXA_CORE_FOUNDATION");

        assertThat(record).isPresent();
        assertThat(record.get().getSchemaVersion()).isEqualTo("V1");
        assertThat(record.get().getEnvironmentTag()).isEqualTo("BOOTSTRAP");
        assertThat(record.get().getInitializedAt()).isNotNull();
    }

    @Test
    void healthEndpointReturnsUpAndConnectedWithCorrelationId() throws Exception {
        mockMvc.perform(get("/api/v1/health")
                        .header("X-Correlation-Id", "test-corr-101"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Correlation-Id", "test-corr-101"))
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.application").value("NORTHSTAR"))
                .andExpect(jsonPath("$.database").value("CONNECTED"));
    }

    @Test
    void healthEnvelopeEndpointReturnsStandardApiResponseStructure() throws Exception {
        mockMvc.perform(get("/api/v1/health/envelope"))
                .andExpect(status().isOk())
                .andExpect(header().exists("X-Correlation-Id"))
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("System is healthy"))
                .andExpect(jsonPath("$.data.status").value("UP"))
                .andExpect(jsonPath("$.data.application").value("NORTHSTAR"))
                .andExpect(jsonPath("$.data.database").value("CONNECTED"))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    void actuatorHealthEndpointIsAvailableWithoutExposingInternalDetails() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.components").doesNotExist());
    }

    @Test
    void protectedRoutesRequireAuthenticationAndReturnStandardUnauthorizedJson() throws Exception {
        mockMvc.perform(get("/api/v1/orders"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    void openApiSpecificationIsGeneratedInDevAndTestProfiles() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.info.title").value("NORTHSTAR API"))
                .andExpect(jsonPath("$.info.version").value("v1"));
    }
}
