package com.ordexa.user.dto;

import com.ordexa.user.entity.UserStatus;
import java.util.UUID;

public record UserProfileDto(
        UUID id,
        String fullName,
        String email,
        UserStatus status
) {
}
