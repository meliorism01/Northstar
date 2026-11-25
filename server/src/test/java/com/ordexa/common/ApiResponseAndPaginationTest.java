package com.ordexa.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.ordexa.common.exception.ErrorCode;
import com.ordexa.common.exception.OrdexaException;
import com.ordexa.common.response.ApiResponse;
import com.ordexa.common.response.PagedResponse;
import com.ordexa.common.validation.PaginationValidator;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ApiResponseAndPaginationTest {

    private final Clock fixedClock = Clock.fixed(Instant.parse("2026-11-25T10:00:00Z"), ZoneOffset.UTC);

    @Test
    void successResponsePopulatesExpectedFields() {
        ApiResponse<Map<String, String>> response = ApiResponse.success(Map.of("key", "value"), fixedClock);

        assertThat(response.success()).isTrue();
        assertThat(response.message()).isEqualTo("Operation completed successfully");
        assertThat(response.data()).containsEntry("key", "value");
        assertThat(response.errorCode()).isNull();
        assertThat(response.timestamp()).isEqualTo(LocalDateTime.of(2026, 11, 25, 10, 0, 0));
    }

    @Test
    void errorResponsePopulatesErrorCodeAndNullData() {
        ApiResponse<Void> response = ApiResponse.error("Invalid request", ErrorCode.VALIDATION_ERROR.name(), fixedClock);

        assertThat(response.success()).isFalse();
        assertThat(response.message()).isEqualTo("Invalid request");
        assertThat(response.errorCode()).isEqualTo("VALIDATION_ERROR");
        assertThat(response.data()).isNull();
        assertThat(response.timestamp()).isEqualTo(LocalDateTime.of(2026, 11, 25, 10, 0, 0));
    }

    @Test
    void paginationValidatorAcceptsValidBoundsAndRejectsInvalidBounds() {
        assertThatCode(() -> PaginationValidator.validate(0, 20)).doesNotThrowAnyException();
        assertThatCode(() -> PaginationValidator.validate(5, 100)).doesNotThrowAnyException();

        assertThatThrownBy(() -> PaginationValidator.validate(-1, 20))
                .isInstanceOf(OrdexaException.class)
                .hasMessageContaining("Page index");

        assertThatThrownBy(() -> PaginationValidator.validate(0, 0))
                .isInstanceOf(OrdexaException.class)
                .hasMessageContaining("Page size");

        assertThatThrownBy(() -> PaginationValidator.validate(0, 101))
                .isInstanceOf(OrdexaException.class)
                .hasMessageContaining("Page size");

        PagedResponse<String> page = new PagedResponse<>(List.of("ORD-1"), 0, 20, 1L, 1, false);
        assertThat(page.items()).containsExactly("ORD-1");
        assertThat(page.totalElements()).isEqualTo(1L);
    }
}
