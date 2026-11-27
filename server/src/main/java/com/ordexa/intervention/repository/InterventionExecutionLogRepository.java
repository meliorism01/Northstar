package com.ordexa.intervention.repository;

import com.ordexa.intervention.entity.InterventionExecutionLog;
import com.ordexa.intervention.model.InterventionEnums.ExecutionLogStatus;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InterventionExecutionLogRepository extends JpaRepository<InterventionExecutionLog, UUID> {
    Optional<InterventionExecutionLog> findByIdempotencyKey(String idempotencyKey);
    List<InterventionExecutionLog> findByMerchantIdAndRecommendationIdOrderByExecutedAtAsc(UUID merchantId, UUID recommendationId);
    List<InterventionExecutionLog> findByMerchantIdAndItemIdOrderByExecutedAtDesc(UUID merchantId, UUID itemId);

    @Query("""
            SELECT e FROM InterventionExecutionLog e
            JOIN InterventionRecommendation r ON r.id = e.recommendationId
            WHERE e.merchantId = :merchantId
              AND r.order.id = :orderId
              AND e.executionStatus = :status
            ORDER BY e.executedAt DESC
            """)
    List<InterventionExecutionLog> findAcceptedByMerchantAndOrder(
            @Param("merchantId") UUID merchantId,
            @Param("orderId") UUID orderId,
            @Param("status") ExecutionLogStatus status);

    @Query("""
            SELECT e FROM InterventionExecutionLog e
            JOIN InterventionRecommendation r ON r.id = e.recommendationId
            WHERE e.merchantId = :merchantId
              AND r.customer.id = :customerId
              AND e.executionStatus = :status
              AND e.executedAt >= :since
            ORDER BY e.executedAt DESC
            """)
    List<InterventionExecutionLog> findRecentAcceptedByMerchantAndCustomer(
            @Param("merchantId") UUID merchantId,
            @Param("customerId") UUID customerId,
            @Param("status") ExecutionLogStatus status,
            @Param("since") OffsetDateTime since);
}
