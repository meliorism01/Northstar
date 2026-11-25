package com.ordexa.common.exception;

import org.springframework.http.HttpStatus;

public class BusinessRuleException extends OrdexaException {

    public BusinessRuleException(String message) {
        super(message, ErrorCode.BUSINESS_RULE_VIOLATION, HttpStatus.UNPROCESSABLE_ENTITY);
    }
}
