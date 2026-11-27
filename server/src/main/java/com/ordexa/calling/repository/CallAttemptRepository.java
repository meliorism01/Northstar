package com.ordexa.calling.repository;

import com.ordexa.calling.entity.CallAttempt;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CallAttemptRepository extends JpaRepository<CallAttempt, UUID> {

    List<CallAttempt> findByCallSession_IdAndMerchantIdOrderByAttemptNumberAsc(
            UUID callSessionId, UUID merchantId);

    Optional<CallAttempt> findFirstByCallSession_IdOrderByAttemptNumberDesc(UUID callSessionId);

    Optional<CallAttempt> findByProviderCallId(String providerCallId);

    Optional<CallAttempt> findByIdempotencyKey(String idempotencyKey);

    long countByMerchantId(UUID merchantId);
}
