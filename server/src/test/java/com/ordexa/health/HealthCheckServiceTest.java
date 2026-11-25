package com.ordexa.health;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.ordexa.health.dto.HealthResponse;
import com.ordexa.health.service.HealthCheckService;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;

class HealthCheckServiceTest {

    @Test
    void checkHealthReturnsUpAndConnectedWhenDatabaseResponds() throws Exception {
        DataSource dataSource = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        PreparedStatement statement = mock(PreparedStatement.class);
        ResultSet resultSet = mock(ResultSet.class);

        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.isValid(anyInt())).thenReturn(true);
        when(connection.prepareStatement("SELECT 1")).thenReturn(statement);
        when(statement.executeQuery()).thenReturn(resultSet);
        when(resultSet.next()).thenReturn(true);
        when(resultSet.getInt(1)).thenReturn(1);

        HealthCheckService service = new HealthCheckService(dataSource, "ORDEXA");
        HealthResponse response = service.checkHealth();

        assertThat(response.status()).isEqualTo("UP");
        assertThat(response.application()).isEqualTo("ORDEXA");
        assertThat(response.database()).isEqualTo("CONNECTED");
    }

    @Test
    void checkHealthReturnsDownAndDisconnectedWhenDatabaseThrowsException() throws Exception {
        DataSource dataSource = mock(DataSource.class);
        when(dataSource.getConnection()).thenThrow(new SQLException("Connection refused"));

        HealthCheckService service = new HealthCheckService(dataSource, "ORDEXA");
        HealthResponse response = service.checkHealth();

        assertThat(response.status()).isEqualTo("DOWN");
        assertThat(response.application()).isEqualTo("ORDEXA");
        assertThat(response.database()).isEqualTo("DISCONNECTED");
    }

    @Test
    void checkHealthReturnsDownWhenConnectionIsInvalid() throws Exception {
        DataSource dataSource = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.isValid(anyInt())).thenReturn(false);

        HealthCheckService service = new HealthCheckService(dataSource, "ORDEXA");
        HealthResponse response = service.checkHealth();

        assertThat(response.status()).isEqualTo("DOWN");
        assertThat(response.database()).isEqualTo("DISCONNECTED");
    }
}
