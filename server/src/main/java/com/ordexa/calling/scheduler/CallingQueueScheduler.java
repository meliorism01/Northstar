package com.ordexa.calling.scheduler;

import com.ordexa.calling.config.CallingProperties;
import com.ordexa.calling.service.CallingWorkflowService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Periodic DB-backed calling queue dispatcher and timeout sweeper.
 * Automatically recovers queued and retry-scheduled COD calls after restarts.
 */
@Component
public class CallingQueueScheduler {

    private static final Logger log = LoggerFactory.getLogger(CallingQueueScheduler.class);

    private final CallingProperties properties;
    private final CallingWorkflowService workflowService;

    public CallingQueueScheduler(
            CallingProperties properties,
            CallingWorkflowService workflowService) {
        this.properties = properties;
        this.workflowService = workflowService;
    }

    @Scheduled(fixedDelayString = "${ordexa.calling.scheduler-interval-ms:15000}")
    public void processQueueAndTimeouts() {
        if (!Boolean.TRUE.equals(properties.enabled())
                || !Boolean.TRUE.equals(properties.schedulerEnabled())) {
            return;
        }
        try {
            int dispatched = workflowService.dispatchDueQueuedSessions(properties.batchSize());
            int swept = workflowService.sweepTimedOutActiveSessions(properties.batchSize());
            if (dispatched > 0 || swept > 0) {
                log.info("[calling-scheduler] Dispatched {} due call(s), swept {} timed-out call(s)", dispatched, swept);
            }
        } catch (Exception ex) {
            log.error("[calling-scheduler] Error during queue tick: {}", ex.getMessage(), ex);
        }
    }
}
