package com.ordexa.intervention.repository;

import com.ordexa.intervention.entity.InterventionPolicy;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InterventionPolicyRepository extends JpaRepository<InterventionPolicy, UUID> {
    Optional<InterventionPolicy> findByMerchantId(UUID merchantId);
}
