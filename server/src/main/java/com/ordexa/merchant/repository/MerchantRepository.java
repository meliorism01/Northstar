package com.ordexa.merchant.repository;

import com.ordexa.merchant.entity.Merchant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MerchantRepository extends JpaRepository<Merchant, UUID> {

    Optional<Merchant> findByBusinessSlug(String businessSlug);

    boolean existsByBusinessSlug(String businessSlug);
}
