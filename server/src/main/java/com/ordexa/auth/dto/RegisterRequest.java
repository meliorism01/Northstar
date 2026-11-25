package com.ordexa.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank(message = "Business name is required")
        @Size(min = 2, max = 140, message = "Business name must be between 2 and 140 characters")
        String businessName,

        @NotBlank(message = "Owner full name is required")
        @Size(min = 2, max = 140, message = "Owner name must be between 2 and 140 characters")
        String ownerName,

        @NotBlank(message = "Email address is required")
        @Email(message = "Please enter a valid business email address")
        @Size(max = 255, message = "Email address must not exceed 255 characters")
        String email,

        @NotBlank(message = "Password is required")
        @Size(min = 8, max = 128, message = "Password must be between 8 and 128 characters")
        String password
) {
    @Override
    public String toString() {
        return "RegisterRequest[businessName=" + businessName
                + ", ownerName=" + ownerName
                + ", email=" + email
                + ", password=[REDACTED]]";
    }
}
