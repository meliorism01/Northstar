package com.ordexa.auth.dto;

import com.ordexa.membership.dto.WorkspaceSummaryDto;
import com.ordexa.user.dto.UserProfileDto;
import java.util.List;

public record AuthSessionResponse(
        String accessToken,
        long accessTokenExpiresInSeconds,
        UserProfileDto user,
        List<WorkspaceSummaryDto> workspaces,
        WorkspaceSummaryDto activeWorkspace,
        boolean requiresWorkspaceSelection
) {
    @Override
    public String toString() {
        return "AuthSessionResponse[accessToken=[REDACTED]"
                + ", accessTokenExpiresInSeconds=" + accessTokenExpiresInSeconds
                + ", user=" + user
                + ", activeWorkspace=" + activeWorkspace
                + ", requiresWorkspaceSelection=" + requiresWorkspaceSelection + "]";
    }
}
