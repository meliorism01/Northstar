package com.ordexa.customer.intelligence.repository;

import com.ordexa.customer.intelligence.entity.CustomerBehaviouralEvent;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CustomerBehaviouralEventRepository extends JpaRepository<CustomerBehaviouralEvent, UUID> {

    List<CustomerBehaviouralEvent> findByMerchantIdAndCustomerIdOrderByOccurredAtDesc(
            UUID merchantId,
            UUID customerId);
}
