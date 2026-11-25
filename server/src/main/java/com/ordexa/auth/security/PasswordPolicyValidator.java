package com.ordexa.auth.security;

import com.ordexa.common.exception.ErrorCode;
import com.ordexa.common.exception.OrdexaException;
import org.springframework.http.HttpStatus;

public final class PasswordPolicyValidator {

    private static final int MIN_LENGTH = 8;
    private static final int MAX_LENGTH = 128;

    private PasswordPolicyValidator() {
    }

    public static void validate(String password) {
        if (password == null || password.length() < MIN_LENGTH || password.length() > MAX_LENGTH) {
            throw new OrdexaException(
                    "Password must be between " + MIN_LENGTH + " and " + MAX_LENGTH + " characters",
                    ErrorCode.VALIDATION_ERROR,
                    HttpStatus.BAD_REQUEST);
        }

        boolean hasUpper = false;
        boolean hasLower = false;
        boolean hasDigit = false;
        boolean hasSpecial = false;

        for (char ch : password.toCharArray()) {
            if (Character.isUpperCase(ch)) {
                hasUpper = true;
            } else if (Character.isLowerCase(ch)) {
                hasLower = true;
            } else if (Character.isDigit(ch)) {
                hasDigit = true;
            } else if (!Character.isWhitespace(ch)) {
                hasSpecial = true;
            }
        }

        if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
            throw new OrdexaException(
                    "Password must include at least one uppercase letter, one lowercase letter, one digit, and one special character",
                    ErrorCode.VALIDATION_ERROR,
                    HttpStatus.BAD_REQUEST);
        }
    }
}
