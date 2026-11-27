package com.ordexa.calling.repository;

import com.ordexa.calling.entity.CallSession;
import com.ordexa.calling.entity.CallSessionStatus;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CallSessionRepository
        extends JpaRepository<CallSession, UUID>, JpaSpecificationExecutor<CallSession> {

    Optional<CallSession> findByMerchantIdAndOrder_Id(UUID merchantId, UUID orderId);

    Optional<CallSession> findByIdempotencyKey(String idempotencyKey);

    @EntityGraph(attributePaths = {"order", "customer"})
    @Query("SELECT cs FROM CallSession cs WHERE cs.id = :id AND cs.merchantId = :merchantId")
    Optional<CallSession> findByIdAndMerchantIdWithDetails(
            @Param("id") UUID id,
            @Param("merchantId") UUID merchantId);

    @EntityGraph(attributePaths = {"order", "customer"})
    @Query("SELECT cs FROM CallSession cs WHERE cs.id = :id")
    Optional<CallSession> findByIdWithDetails(@Param("id") UUID id);

    @EntityGraph(attributePaths = {"order", "customer"})
    List<CallSession> findByMerchantIdOrderByCreatedAtDesc(UUID merchantId);

    List<CallSession> findByMerchantIdAndCustomer_IdOrderByCreatedAtDesc(UUID merchantId, UUID customerId);

    @EntityGraph(attributePaths = {"order", "customer"})
    @Query("""
            SELECT cs FROM CallSession cs
            WHERE cs.status IN :statuses
              AND cs.doNotCallFurther = false
              AND (cs.nextAttemptAt IS NULL OR cs.nextAttemptAt <= :now)
            ORDER BY cs.nextAttemptAt ASC
            """)
    List<CallSession> findDueSessions(
            @Param("statuses") Collection<CallSessionStatus> statuses,
            @Param("now") OffsetDateTime now,
            Pageable pageable);

    @EntityGraph(attributePaths = {"order", "customer"})
    @Query("""
            SELECT cs FROM CallSession cs
            WHERE cs.status IN :activeStatuses
              AND cs.lastAttemptAt IS NOT NULL
              AND cs.lastAttemptAt < :cutoff
            """)
    List<CallSession> findTimedOutActiveSessions(
            @Param("activeStatuses") Collection<CallSessionStatus> activeStatuses,
            @Param("cutoff") OffsetDateTime cutoff,
            Pageable pageable);
}
