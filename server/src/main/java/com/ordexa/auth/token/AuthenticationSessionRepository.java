package com.ordexa.auth.token;

import com.ordexa.auth.entity.AuthenticationSession;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface AuthenticationSessionRepository extends JpaRepository<AuthenticationSession, UUID> {

    @Query("""
            SELECT s FROM AuthenticationSession s
            JOIN FETCH s.user u
            LEFT JOIN FETCH s.activeMerchant m
            WHERE s.id = :sessionId
            """)
    Optional<AuthenticationSession> findByIdWithUserAndMerchant(@Param("sessionId") UUID sessionId);
}
