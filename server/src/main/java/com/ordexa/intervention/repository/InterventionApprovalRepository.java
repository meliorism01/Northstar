package com.ordexa.intervention.repository;

import com.ordexa.intervention.entity.InterventionApproval;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InterventionApprovalRepository extends JpaRepository<InterventionApproval, UUID> {
    List<InterventionApproval> findByMerchantIdAndRecommendationIdOrderByCreatedAtAsc(UUID merchantId, UUID recommendationId);
    List<InterventionApproval> findByMerchantIdAndItemIdOrderByCreatedAtDesc(UUID merchantId, UUID itemId);
}
