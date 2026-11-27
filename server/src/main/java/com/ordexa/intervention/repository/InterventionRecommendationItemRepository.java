package com.ordexa.intervention.repository;

import com.ordexa.intervention.entity.InterventionRecommendationItem;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InterventionRecommendationItemRepository extends JpaRepository<InterventionRecommendationItem, UUID> {

    @Query("""
            SELECT i FROM InterventionRecommendationItem i
            JOIN FETCH i.recommendation r
            JOIN FETCH r.order o
            JOIN FETCH r.customer c
            WHERE i.id = :itemId AND i.merchantId = :merchantId
            """)
    Optional<InterventionRecommendationItem> findByIdAndMerchantIdWithRecommendation(
            @Param("itemId") UUID itemId,
            @Param("merchantId") UUID merchantId);

    @Query("""
            SELECT i FROM InterventionRecommendationItem i
            JOIN i.recommendation r
            WHERE i.merchantId = :merchantId AND r.order.id = :orderId
            """)
    List<InterventionRecommendationItem> findAllByMerchantIdAndOrderId(
            @Param("merchantId") UUID merchantId,
            @Param("orderId") UUID orderId);
}
