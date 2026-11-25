package com.ordexa.common;

import static org.assertj.core.api.Assertions.assertThat;

import com.ordexa.common.exception.BusinessRuleException;
import com.ordexa.common.exception.GlobalExceptionHandler;
import com.ordexa.common.exception.ResourceNotFoundException;
import com.ordexa.common.response.ApiResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataRetrievalFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

class GlobalExceptionHandlerTest {

    private GlobalExceptionHandler handler;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(Instant.parse("2026-11-25T10:00:00Z"), ZoneOffset.UTC);
        handler = new GlobalExceptionHandler(clock);
    }

    @Test
    void handlesResourceNotFoundWith404() {
        ResponseEntity<ApiResponse<Void>> response =
                handler.handleOrdexaException(new ResourceNotFoundException("Order ORD-26410 not found"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().success()).isFalse();
        assertThat(response.getBody().errorCode()).isEqualTo("RESOURCE_NOT_FOUND");
        assertThat(response.getBody().message()).isEqualTo("Order ORD-26410 not found");
    }

    @Test
    void handlesBusinessRuleExceptionWith422() {
        ResponseEntity<ApiResponse<Void>> response =
                handler.handleOrdexaException(new BusinessRuleException("Order cannot be manifested while on hold"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().errorCode()).isEqualTo("BUSINESS_RULE_VIOLATION");
    }

    @Test
    void handlesDatabaseFailureWith503WithoutLeakingSqlDetails() {
        ResponseEntity<ApiResponse<Void>> response =
                handler.handleDataAccessException(new DataRetrievalFailureException("FATAL: password authentication failed"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().errorCode()).isEqualTo("DATABASE_UNAVAILABLE");
        assertThat(response.getBody().message()).doesNotContain("password");
    }

    @Test
    void handlesUnexpectedExceptionWith500WithoutLeakingInternals() {
        ResponseEntity<ApiResponse<Void>> response =
                handler.handleUnexpectedException(new RuntimeException("Internal NPE at com.ordexa.SecretClass:42"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().errorCode()).isEqualTo("INTERNAL_ERROR");
        assertThat(response.getBody().message()).isEqualTo("An unexpected internal error occurred");
    }
}
