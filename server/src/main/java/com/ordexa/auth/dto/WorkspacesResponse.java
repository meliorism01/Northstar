package com.ordexa.auth.dto;

import com.ordexa.membership.dto.WorkspaceSummaryDto;
import java.util.List;
import java.util.UUID;

public record WorkspacesResponse(
        List<WorkspaceSummaryDto> workspaces,
        UUID activeMerchantId
) {
}
