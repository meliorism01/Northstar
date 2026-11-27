package com.ordexa.intervention.repository;

import com.ordexa.intervention.entity.InterventionCustomerConsent;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InterventionCustomerConsentRepository extends JpaRepository<InterventionCustomerConsent, UUID> {
    Optional<InterventionCustomerConsent> findByMerchantIdAndCustomerId(UUID merchantId, UUID customerId);
}
