package com.ordexa.calling.repository;

import com.ordexa.calling.entity.CallEvent;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CallEventRepository extends JpaRepository<CallEvent, UUID> {

    boolean existsByWebhookEventId(String webhookEventId);

    List<CallEvent> findByCallSessionIdAndMerchantIdOrderByCreatedAtAsc(
            UUID callSessionId, UUID merchantId);
}
