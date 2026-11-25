package com.ordexa.auth.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record SelectWorkspaceRequest(
        @NotNull(message = "merchantId is required")
        UUID merchantId
) {
}
