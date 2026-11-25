package com.ordexa.membership.repository;

import com.ordexa.membership.entity.MembershipStatus;
import com.ordexa.membership.entity.MerchantMembership;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface MerchantMembershipRepository extends JpaRepository<MerchantMembership, UUID> {

    @Query("""
            SELECT m FROM MerchantMembership m
            JOIN FETCH m.merchant merch
            WHERE m.user.id = :userId
              AND m.status = :membershipStatus
              AND merch.status = com.ordexa.merchant.entity.MerchantStatus.ACTIVE
            ORDER BY m.createdAt ASC
            """)
    List<MerchantMembership> findActiveMembershipsWithMerchant(
            @Param("userId") UUID userId,
            @Param("membershipStatus") MembershipStatus membershipStatus);

    @Query("""
            SELECT m FROM MerchantMembership m
            JOIN FETCH m.merchant merch
            JOIN FETCH m.user u
            WHERE m.merchant.id = :merchantId
              AND m.user.id = :userId
            """)
    Optional<MerchantMembership> findByMerchantIdAndUserIdWithDetails(
            @Param("merchantId") UUID merchantId,
            @Param("userId") UUID userId);

    @Query("""
            SELECT m FROM MerchantMembership m
            JOIN FETCH m.user u
            WHERE m.merchant.id = :merchantId
            ORDER BY m.createdAt ASC
            """)
    List<MerchantMembership> findAllByMerchantIdWithUser(@Param("merchantId") UUID merchantId);
}
