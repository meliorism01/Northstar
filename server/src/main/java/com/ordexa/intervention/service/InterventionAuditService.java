package com.ordexa.intervention.service;

import com.ordexa.auth.entity.AuditLog;
import com.ordexa.auth.token.AuditLogRepository;
import com.ordexa.intervention.entity.InterventionAuditEvent;
import com.ordexa.intervention.repository.InterventionAuditEventRepository;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Append-only audit service for NBIE recommendations, action approvals/rejections,
 * sandbox executions, and outcomes.
 *
 * Sanitizes metadata and never logs phone numbers, full addresses, tokens, secrets, or transcripts.
 */
@Service
public class InterventionAuditService {

    private static final Logger log = LoggerFactory.getLogger(InterventionAuditService.class);

    private final InterventionAuditEventRepository auditEventRepository;
    private final AuditLogRepository workspaceAuditRepository;
    private final Clock clock;

    public InterventionAuditService(
            InterventionAuditEventRepository auditEventRepository,
            AuditLogRepository workspaceAuditRepository,
            Clock clock) {
        this.auditEventRepository = auditEventRepository;
        this.workspaceAuditRepository = workspaceAuditRepository;
        this.clock = clock;
    }

    @Transactional
    public InterventionAuditEvent appendEvent(
            UUID merchantId,
            UUID orderId,
            UUID recommendationId,
            UUID itemId,
            UUID actorUserId,
            String actorLabel,
            String eventType,
            String rulesetVersion,
            String summary,
            Map<String, Object> metadata,
            String clientIp) {

        OffsetDateTime now = OffsetDateTime.now(clock);
        String corrId = MDC.get("correlationId");
        Map<String, Object> safeMeta = sanitizeMetadata(metadata);

        InterventionAuditEvent event = auditEventRepository.save(new InterventionAuditEvent(
                merchantId,
                orderId,
                recommendationId,
                itemId,
                actorUserId,
                actorLabel != null && !actorLabel.isBlank() ? actorLabel : "SYSTEM",
                eventType,
                rulesetVersion != null ? rulesetVersion : "NBIE_RULESET_V1",
                corrId,
                truncate(summary, 500),
                safeMeta,
                now));

        workspaceAuditRepository.save(new AuditLog(
                merchantId,
                actorUserId,
                "NBIE_" + eventType,
                "INTERVENTION_RECOMMENDATION",
                recommendationId != null ? recommendationId.toString() : orderId.toString(),
                truncate(summary, 980),
                clientIp));

        log.info("[nbie-audit] eventType={} merchantId={} orderId={} recommendationId={} itemId={} ruleset={}",
                eventType, merchantId, orderId, recommendationId, itemId, rulesetVersion);

        return event;
    }

    public static Map<String, Object> sanitizeMetadata(Map<String, Object> raw) {
        if (raw == null || raw.isEmpty()) {
            return Collections.emptyMap();
        }
        Map<String, Object> cleaned = new LinkedHashMap<>();
        raw.forEach((k, v) -> {
            if (k == null) {
                return;
            }
            String lower = k.toLowerCase();
            if (lower.contains("phone")
                    || lower.contains("street")
                    || lower.contains("shippingaddress")
                    || lower.contains("billingaddress")
                    || lower.contains("secret")
                    || lower.contains("token")
                    || lower.contains("password")
                    || lower.contains("transcript")) {
                return;
            }
            cleaned.put(k, v);
        });
        return cleaned;
    }

    private static String truncate(String s, int maxLen) {
        if (s == null) {
            return "";
        }
        return s.length() <= maxLen ? s : s.substring(0, maxLen);
    }
}
