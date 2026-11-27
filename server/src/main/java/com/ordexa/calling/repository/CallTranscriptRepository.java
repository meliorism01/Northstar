package com.ordexa.calling.repository;

import com.ordexa.calling.entity.CallTranscript;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CallTranscriptRepository extends JpaRepository<CallTranscript, UUID> {

    List<CallTranscript> findByCallSessionIdAndMerchantIdOrderByOccurredAtAscTurnIndexAsc(
            UUID callSessionId, UUID merchantId);

    List<CallTranscript> findByCallAttemptIdOrderByTurnIndexAsc(UUID callAttemptId);

    Optional<CallTranscript> findByCallAttemptIdAndTurnIndex(UUID callAttemptId, int turnIndex);
}
