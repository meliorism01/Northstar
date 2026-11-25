package com.ordexa.customer.repository;

import com.ordexa.customer.entity.Customer;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface CustomerRepository extends JpaRepository<Customer, UUID> {

    Optional<Customer> findByIdAndMerchantId(UUID id, UUID merchantId);

    Optional<Customer> findByMerchantIdAndPhoneNumber(UUID merchantId, String phoneNumber);

    @Query("""
            SELECT c FROM Customer c
            WHERE c.merchantId = :merchantId
              AND (
                   :searchPattern IS NULL
                   OR LOWER(c.fullName) LIKE :searchPattern
                   OR LOWER(c.phoneNumber) LIKE :searchPattern
                   OR (c.email IS NOT NULL AND LOWER(c.email) LIKE :searchPattern)
              )
            """)
    Page<Customer> searchByMerchant(
            @Param("merchantId") UUID merchantId,
            @Param("searchPattern") String searchPattern,
            Pageable pageable);

    long countByMerchantId(UUID merchantId);
}
