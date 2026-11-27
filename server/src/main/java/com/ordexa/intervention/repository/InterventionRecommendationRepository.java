package com.ordexa.intervention.repository;

import com.ordexa.intervention.entity.InterventionRecommendation;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InterventionRecommendationRepository
        extends JpaRepository<InterventionRecommendation, UUID>, JpaSpecificationExecutor<InterventionRecommendation> {

    @Query("""
            SELECT DISTINCT r FROM InterventionRecommendation r
            JOIN FETCH r.order o
            JOIN FETCH r.customer c
            LEFT JOIN FETCH r.items i
            WHERE r.id = :id AND r.merchantId = :merchantId
            """)
    Optional<InterventionRecommendation> findByIdAndMerchantIdWithDetails(
            @Param("id") UUID id,
            @Param("merchantId") UUID merchantId);

    @Query("""
            SELECT DISTINCT r FROM InterventionRecommendation r
            JOIN FETCH r.order o
            JOIN FETCH r.customer c
            LEFT JOIN FETCH r.items i
            WHERE r.merchantId = :merchantId AND o.id = :orderId
            ORDER BY r.evaluatedAt DESC
            """)
    List<InterventionRecommendation> findByMerchantIdAndOrderIdWithDetailsOrderByEvaluatedAtDesc(
            @Param("merchantId") UUID merchantId,
            @Param("orderId") UUID orderId);

    @Query("""
            SELECT DISTINCT r FROM InterventionRecommendation r
            LEFT JOIN FETCH r.items i
            WHERE r.merchantId = :merchantId AND r.order.id = :orderId AND r.activeRecord = true
            ORDER BY r.evaluatedAt DESC
            """)
    List<InterventionRecommendation> findActiveByMerchantIdAndOrderId(
            @Param("merchantId") UUID merchantId,
            @Param("orderId") UUID orderId);

    List<InterventionRecommendation> findByMerchantIdAndActiveRecordTrue(UUID merchantId);
}
