package com.ordexa.intervention.adapter;

import com.ordexa.intervention.entity.InterventionRecommendationItem;
import com.ordexa.intervention.model.InterventionEnums.ExecutionLogStatus;
import com.ordexa.intervention.model.InterventionEnums.ExecutionProviderMode;
import com.ordexa.intervention.model.InterventionEnums.InterventionChannel;
import com.ordexa.order.entity.Order;
import java.util.Map;

/**
 * Narrow execution boundary between NBIE and authorized sandbox adapters.
 * NBIE never accesses telephony SDKs, payment gateways, or provider credentials.
 */
public interface InterventionExecutionAdapter {

    String adapterCode();

    boolean supports(InterventionChannel channel);

    AdapterExecutionResult executeSandbox(
            Order order,
            InterventionRecommendationItem item,
            String idempotencyKey);

    record AdapterExecutionResult(
            boolean accepted,
            ExecutionProviderMode providerMode,
            ExecutionLogStatus status,
            String externalReferenceId,
            Map<String, Object> sanitizedMetadata
    ) {
    }
}
