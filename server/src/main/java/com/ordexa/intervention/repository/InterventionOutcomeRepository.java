package com.ordexa.intervention.repository;

import com.ordexa.intervention.entity.InterventionOutcome;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InterventionOutcomeRepository extends JpaRepository<InterventionOutcome, UUID> {
    Optional<InterventionOutcome> findByIdempotencyKey(String idempotencyKey);
    List<InterventionOutcome> findByMerchantIdAndRecommendationIdOrderByRecordedAtAsc(UUID merchantId, UUID recommendationId);

    @Query("""
            SELECT o FROM InterventionOutcome o
            JOIN InterventionRecommendation r ON r.id = o.recommendationId
            WHERE o.merchantId = :merchantId AND r.order.id = :orderId
            ORDER BY o.recordedAt DESC
            """)
    List<InterventionOutcome> findByMerchantIdAndOrderIdOrderByRecordedAtDesc(
            @Param("merchantId") UUID merchantId,
            @Param("orderId") UUID orderId);
}
