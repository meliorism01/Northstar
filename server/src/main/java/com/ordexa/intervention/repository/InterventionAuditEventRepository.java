package com.ordexa.intervention.repository;

import com.ordexa.intervention.entity.InterventionAuditEvent;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InterventionAuditEventRepository extends JpaRepository<InterventionAuditEvent, UUID> {
    List<InterventionAuditEvent> findByMerchantIdAndRecommendationIdOrderByCreatedAtAsc(UUID merchantId, UUID recommendationId);
    List<InterventionAuditEvent> findByMerchantIdAndOrderIdOrderByCreatedAtDesc(UUID merchantId, UUID orderId);
}
