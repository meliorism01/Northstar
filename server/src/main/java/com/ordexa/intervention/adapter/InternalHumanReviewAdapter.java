package com.ordexa.intervention.adapter;

import com.ordexa.intervention.entity.InterventionRecommendationItem;
import com.ordexa.intervention.model.InterventionEnums.ExecutionLogStatus;
import com.ordexa.intervention.model.InterventionEnums.ExecutionProviderMode;
import com.ordexa.intervention.model.InterventionEnums.InterventionChannel;
import com.ordexa.order.entity.Order;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Internal operator queue adapter for {@code HUMAN_REVIEW} actions.
 * Routes unresolved/conflicting evidence to the merchant operations desk
 * without placing an order hold or contacting the customer.
 */
@Component
public class InternalHumanReviewAdapter implements InterventionExecutionAdapter {

    public static final String CODE = "INTERNAL_HUMAN_REVIEW_ADAPTER";

    @Override
    public String adapterCode() {
        return CODE;
    }

    @Override
    public boolean supports(InterventionChannel channel) {
        return channel == InterventionChannel.INTERNAL_QUEUE;
    }

    @Override
    public AdapterExecutionResult executeSandbox(
            Order order,
            InterventionRecommendationItem item,
            String idempotencyKey) {
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("interventionType", item.getInterventionType().name());
        meta.put("routedQueue", "MERCHANT_OPS_REVIEW");
        meta.put("orderMutated", false);
        meta.put("authorityNote", "Human review assignment does not place a dispatch hold or change order status.");
        return new AdapterExecutionResult(
                true,
                ExecutionProviderMode.INTERNAL,
                ExecutionLogStatus.ACCEPTED_SANDBOX,
                "ops-review-" + item.getId(),
                meta);
    }
}
