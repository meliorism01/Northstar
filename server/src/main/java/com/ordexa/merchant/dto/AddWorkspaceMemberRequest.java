package com.ordexa.merchant.dto;

import com.ordexa.membership.entity.MerchantRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AddWorkspaceMemberRequest(
        @NotBlank(message = "Full name is required")
        @Size(min = 2, max = 140)
        String fullName,

        @NotBlank(message = "Email is required")
        @Email(message = "Valid email is required")
        String email,

        @Size(min = 8, max = 128, message = "Initial password must be between 8 and 128 characters if creating a new user")
        String initialPassword,

        @NotNull(message = "Role is required")
        MerchantRole role
) {
    @Override
    public String toString() {
        return "AddWorkspaceMemberRequest[fullName=" + fullName
                + ", email=" + email
                + ", initialPassword=[REDACTED]"
                + ", role=" + role + "]";
    }
}
