package com.ordexa.auth.token;

import com.ordexa.auth.entity.RefreshToken;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    @Query("""
            SELECT rt FROM RefreshToken rt
            JOIN FETCH rt.user u
            JOIN FETCH rt.session s
            LEFT JOIN FETCH s.activeMerchant m
            WHERE rt.tokenHash = :tokenHash
            """)
    Optional<RefreshToken> findByTokenHashWithDetails(@Param("tokenHash") String tokenHash);

    @Query("""
            SELECT rt FROM RefreshToken rt
            WHERE rt.session.id = :sessionId
              AND rt.revokedAt IS NULL
            """)
    List<RefreshToken> findAllActiveBySessionId(@Param("sessionId") UUID sessionId);
}
