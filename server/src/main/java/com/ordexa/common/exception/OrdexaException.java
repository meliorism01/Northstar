package com.ordexa.common.exception;

import org.springframework.http.HttpStatus;

public class OrdexaException extends RuntimeException {

    private final ErrorCode errorCode;
    private final HttpStatus httpStatus;

    public OrdexaException(String message, ErrorCode errorCode, HttpStatus httpStatus) {
        super(message);
        this.errorCode = errorCode;
        this.httpStatus = httpStatus;
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }

    public HttpStatus getHttpStatus() {
        return httpStatus;
    }
}
