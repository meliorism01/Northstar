package com.ordexa.merchant.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateMerchantRequest(
        @NotBlank(message = "Business name is required")
        @Size(min = 2, max = 140, message = "Business name must be between 2 and 140 characters")
        String businessName
) {
}
