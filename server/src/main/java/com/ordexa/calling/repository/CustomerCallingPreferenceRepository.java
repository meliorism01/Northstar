package com.ordexa.calling.repository;

import com.ordexa.calling.entity.CustomerCallingPreference;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomerCallingPreferenceRepository extends JpaRepository<CustomerCallingPreference, UUID> {
    Optional<CustomerCallingPreference> findByMerchantIdAndCustomerId(UUID merchantId, UUID customerId);
}
