package com.ordexa.common.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiResponse<T>(
        boolean success,
        String message,
        T data,
        String errorCode,
        Map<String, String> fieldErrors,
        LocalDateTime timestamp
) {

    public static <T> ApiResponse<T> success(String message, T data, Clock clock) {
        return new ApiResponse<>(
                true,
                message,
                data,
                null,
                null,
                LocalDateTime.now(clock).truncatedTo(ChronoUnit.SECONDS)
        );
    }

    public static <T> ApiResponse<T> success(T data, Clock clock) {
        return success("Operation completed successfully", data, clock);
    }

    public static <T> ApiResponse<T> error(String message, String errorCode, Clock clock) {
        return new ApiResponse<>(
                false,
                message,
                null,
                errorCode,
                null,
                LocalDateTime.now(clock).truncatedTo(ChronoUnit.SECONDS)
        );
    }

    public static <T> ApiResponse<T> validationError(
            String message,
            String errorCode,
            Map<String, String> fieldErrors,
            Clock clock) {
        return new ApiResponse<>(
                false,
                message,
                null,
                errorCode,
                fieldErrors,
                LocalDateTime.now(clock).truncatedTo(ChronoUnit.SECONDS)
        );
    }
}
