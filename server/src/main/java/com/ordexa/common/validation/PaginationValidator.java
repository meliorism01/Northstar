package com.ordexa.common.validation;

import com.ordexa.common.exception.ErrorCode;
import com.ordexa.common.exception.OrdexaException;
import org.springframework.http.HttpStatus;

public final class PaginationValidator {

    public static final int DEFAULT_PAGE = 0;
    public static final int DEFAULT_SIZE = 20;
    public static final int MAX_PAGE_SIZE = 100;

    private PaginationValidator() {
    }

    public static void validate(int page, int size) {
        if (page < 0) {
            throw new OrdexaException(
                    "Page index must not be negative",
                    ErrorCode.VALIDATION_ERROR,
                    HttpStatus.BAD_REQUEST);
        }
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw new OrdexaException(
                    "Page size must be between 1 and " + MAX_PAGE_SIZE,
                    ErrorCode.VALIDATION_ERROR,
                    HttpStatus.BAD_REQUEST);
        }
    }
}
