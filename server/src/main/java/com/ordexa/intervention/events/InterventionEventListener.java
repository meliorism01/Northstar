package com.ordexa.intervention.events;

import com.ordexa.calling.events.OrderCreatedForCallingEvent;
import com.ordexa.intervention.config.NbieProperties;
import com.ordexa.intervention.service.InterventionEngineService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Safe, non-blocking, non-recursive event integration for NBIE.
 *
 * Ordered AFTER {@code CallingWorkflowService.onOrderCreated} ({@code @Order(200)})
 * so any initial calling session enrollment is already present before NBIE assembles context.
 * Gated by {@code northstar.nbie.auto-evaluate} (default {@code false} for controlled rollout).
 * Never emits order events, preventing recursive loops.
 */
@Component
public class InterventionEventListener {

    private static final Logger log = LoggerFactory.getLogger(InterventionEventListener.class);

    private final NbieProperties nbieProperties;
    private final InterventionEngineService engineService;

    public InterventionEventListener(
            NbieProperties nbieProperties,
            InterventionEngineService engineService) {
        this.nbieProperties = nbieProperties;
        this.engineService = engineService;
    }

    @EventListener
    @Order(200)
    public void onOrderCreated(OrderCreatedForCallingEvent event) {
        if (!nbieProperties.isEnabled() || !nbieProperties.isAutoEvaluate()) {
            return;
        }
        try {
            engineService.evaluateSystemEvent(event.merchantId(), event.orderId());
        } catch (Exception ex) {
            // Never fail or roll back order creation due to NBIE recommendation failure
            log.warn("[nbie-event] Non-fatal auto-evaluation failure for orderId={}: {}",
                    event.orderId(), ex.getClass().getSimpleName());
        }
    }
}
