package com.ordexa.health.service;

import com.ordexa.health.dto.HealthResponse;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class HealthCheckService {

    private static final Logger log = LoggerFactory.getLogger(HealthCheckService.class);
    private static final int VALIDATION_TIMEOUT_SECONDS = 3;

    private final DataSource dataSource;
    private final String applicationName;

    public HealthCheckService(
            DataSource dataSource,
            @Value("${spring.application.name:NORTHSTAR}") String applicationName) {
        this.dataSource = dataSource;
        this.applicationName = applicationName;
    }

    public HealthResponse checkHealth() {
        boolean dbConnected = verifyDatabaseConnectivity();
        if (dbConnected) {
            return new HealthResponse("UP", applicationName, "CONNECTED");
        }
        return new HealthResponse("DOWN", applicationName, "DISCONNECTED");
    }

    public boolean verifyDatabaseConnectivity() {
        try (Connection connection = dataSource.getConnection()) {
            if (connection == null || !connection.isValid(VALIDATION_TIMEOUT_SECONDS)) {
                log.warn("Database connection validation failed (isValid returned false)");
                return false;
            }
            try (PreparedStatement statement = connection.prepareStatement("SELECT 1");
                 ResultSet resultSet = statement.executeQuery()) {
                return resultSet.next() && resultSet.getInt(1) == 1;
            }
        } catch (Exception ex) {
            log.warn("Database connectivity check failed: {}", ex.getMessage());
            return false;
        }
    }
}
