package com.ordexa.auth.dto;

import com.ordexa.membership.dto.WorkspaceSummaryDto;
import com.ordexa.user.dto.UserProfileDto;

public record RegisterResponse(
        UserProfileDto user,
        WorkspaceSummaryDto workspace
) {
}
