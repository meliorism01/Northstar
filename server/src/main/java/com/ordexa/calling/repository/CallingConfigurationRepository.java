package com.ordexa.calling.repository;

import com.ordexa.calling.entity.CallingConfiguration;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CallingConfigurationRepository extends JpaRepository<CallingConfiguration, UUID> {
    Optional<CallingConfiguration> findByMerchantId(UUID merchantId);
}
